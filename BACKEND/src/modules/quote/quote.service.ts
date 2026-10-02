import { Quote, QuoteAttributes } from './quote.model';
import { QuoteItem, QuoteItemAttributes } from './quote-item.model';
import { Customer } from '@/modules/customer/customer.model';
import { User } from '@/modules/user/user.model';
import { Product } from '@/modules/product/product.model';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  QuoteResponseDto,
  QuotesListResponseDto,
  SearchQuoteDto
} from './quote.dto';
import { NotFoundError, ConflictError, BadRequestError } from '@/core/errors/AppError';
import logger from '@/core/logger';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createQuoteSchema, updateQuoteSchema, searchQuoteSchema } from './quote.dto';
import { Op, UniqueConstraintError, literal } from 'sequelize';
import sequelize from '@/database';
import { OrderService } from '@/modules/order/order.service';
import { OrderResponseDto } from '@/modules/order/order.dto';
import { lineTotal, computeOrderTotal } from '@/modules/order/order-totals';

const CUSTOMER_ATTRS = ['id', 'name', 'code', 'nit', 'contact', 'address'] as const;

export class QuoteService {
  private orderService = new OrderService();

  /**
   * Genera el siguiente número de cotización en formato COT-XXXX (ej: COT-0001, COT-0011),
   * único por tenant (no global). Mismo algoritmo robusto que
   * order.service.ts::generateOrderNumber — MAX numérico en vez de orden alfabético
   * (evita que COT-9X > COT-1XX).
   */
  private async generateQuoteNumber(tenantId: number): Promise<string> {
    try {
      const result = await Quote.findOne({
        attributes: [[literal('MAX(CAST(SUBSTRING(quoteNumber, 5) AS UNSIGNED))'), 'maxNum']],
        where: { tenantId, quoteNumber: { [Op.like]: 'COT-%' } },
        paranoid: false,
        raw: true,
      }) as any;

      const maxNum = result?.maxNum ?? 0;
      const nextNumber = (parseInt(String(maxNum)) || 0) + 1;
      return `COT-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      logger.error('Error generating quote number:', error as Error);
      return `COT-${Date.now()}`;
    }
  }

  /**
   * Crea una nueva cotización con sus items. A diferencia de una orden, NO descuenta
   * stock — es una propuesta comercial, no una venta concretada.
   * Valida que cliente/productos pertenezcan al tenant del JWT (mismo fix de IDOR que
   * order.service.ts ya aplica — nunca confiar en un customerId/productId ajeno).
   * Si no se provee quoteNumber, lo genera automáticamente.
   */
  async createQuote(quoteData: CreateQuoteDto, userId: number, tenantId: number): Promise<QuoteResponseDto> {
    const validatedData = validateSchema(createQuoteSchema, quoteData);

    // Idempotencia: si este clientRef ya creó una cotización (reintento tras timeout,
    // doble pestaña sincronizando), devolver la existente en vez de duplicar
    if (validatedData.clientRef) {
      const existing = await Quote.findOne({
        where: { tenantId, clientRef: validatedData.clientRef },
        paranoid: false,
      });
      if (existing) {
        const items = await QuoteItem.findAll({ where: { quoteId: existing.id } });
        return this.mapToResponseDto(existing, items);
      }
    }

    const customer = await Customer.findOne({ where: { id: validatedData.customerId, tenantId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    for (const item of validatedData.items) {
      const product = await Product.findOne({ where: { id: item.productId, tenantId } });
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId} not found`);
      }
    }

    // Total con IVA incluido por línea — misma fórmula compartida con Orders/POS
    // (order-totals.ts), para que una cotización convertida a orden no cambie de total.
    const totalAmount = computeOrderTotal(validatedData.items);

    // Create quote + items inside a transaction, retrying up to 3 times on duplicate quote number
    for (let attempt = 0; attempt < 3; attempt++) {
      const quoteNumber = validatedData.quoteNumber ?? await this.generateQuoteNumber(tenantId);
      const t = await sequelize.transaction();
      try {
        const quote = await Quote.create({
          tenantId,
          quoteNumber,
          clientRef: validatedData.clientRef ?? null,
          customerId: validatedData.customerId,
          userId,
          totalAmount,
          status: validatedData.status,
          notes: validatedData.notes ?? null,
          validUntil: validatedData.validUntil ?? null,
          convertedOrderId: null,
        } as QuoteAttributes, { transaction: t });

        const quoteItems = await Promise.all(
          validatedData.items.map(item =>
            QuoteItem.create({
              quoteId: quote.id,
              taxRate: item.taxRate,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: lineTotal(item.quantity, item.unitPrice, item.taxRate),
            } as QuoteItemAttributes, { transaction: t })
          )
        );

        await t.commit();
        return this.mapToResponseDto(quote, quoteItems);
      } catch (err) {
        await t.rollback();
        if (err instanceof UniqueConstraintError && !validatedData.quoteNumber && attempt < 2) {
          logger.warn(`Quote number collision on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate a unique quote number after 3 attempts');
  }

  async getNextQuoteNumber(tenantId: number): Promise<{ nextQuoteNumber: string }> {
    const nextNumber = await this.generateQuoteNumber(tenantId);
    return { nextQuoteNumber: nextNumber };
  }

  async getAllQuotes(query: PaginationQuery, tenantId: number): Promise<QuotesListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Quote.findAndCountAll({
      where: { tenantId },
      distinct: true,
      include: [
        { model: Customer, as: 'customer', attributes: [...CUSTOMER_ATTRS] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
        {
          model: QuoteItem,
          as: 'quoteItems',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit'] }],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const quotes = rows.map(quote => this.mapToResponseDto(quote, quote.quoteItems));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      quotes,
      pagination: { page: validatedPage, limit: validatedLimit, total: Number(count), totalPages },
    };
  }

  async getQuoteById(id: number, tenantId: number): Promise<QuoteResponseDto> {
    const quote = await Quote.findOne({
      where: { id, tenantId },
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'user' },
        { model: QuoteItem, as: 'quoteItems', include: [{ model: Product, as: 'product' }] },
      ],
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    return this.mapToResponseDto(quote, quote.quoteItems);
  }

  /**
   * Actualiza una cotización y sincroniza sus items dentro de una transacción DB.
   * Mismo algoritmo de sync de items que order.service.ts::updateOrder.
   * Una cotización ya convertida ('converted') se bloquea para edición.
   */
  async updateQuote(id: number, updateData: UpdateQuoteDto, tenantId: number): Promise<QuoteResponseDto> {
    const validatedData = validatePartialSchema(updateQuoteSchema, updateData) as Partial<UpdateQuoteDto>;

    const transaction = await sequelize.transaction();
    try {
      const quote = await Quote.findOne({ where: { id, tenantId }, transaction });
      if (!quote) {
        throw new NotFoundError('Quote not found');
      }

      // Una cotización convertida es un registro histórico — la venta real ya vive en la
      // orden generada. Bloquea CUALQUIER campo, no solo status/items (dejar pasar
      // notes/customerId/validUntil desalinearía la cotización del pedido real que
      // supuestamente describe, un hueco real que tenía el guard anterior más angosto).
      if (quote.status === 'converted') {
        throw new ConflictError('No se puede modificar una cotización ya convertida a orden');
      }

      if (validatedData.customerId !== undefined) {
        const customer = await Customer.findOne({ where: { id: validatedData.customerId, tenantId }, transaction });
        if (!customer) throw new NotFoundError('Customer not found');
      }

      await quote.update(validatedData as any, { transaction });

      if (validatedData.items) {
        const existingItems = await QuoteItem.findAll({ where: { quoteId: id }, transaction });
        const existingItemIds = existingItems.map(item => item.id);
        const updatedItemIds = validatedData.items.filter(item => !!item.id).map(item => item.id);

        const itemsToDelete = existingItemIds.filter(itemId => !updatedItemIds.includes(itemId));
        if (itemsToDelete.length > 0) {
          await QuoteItem.destroy({ where: { id: itemsToDelete }, transaction });
        }

        for (const item of validatedData.items) {
          if (
            typeof item.productId === 'number' &&
            typeof item.quantity === 'number' &&
            typeof item.unitPrice === 'number' &&
            typeof item.taxRate === 'number'
          ) {
            const product = await Product.findOne({ where: { id: item.productId, tenantId }, transaction });
            if (!product) throw new NotFoundError(`Product with ID ${item.productId} not found`);

            if (item.id && existingItemIds.includes(item.id)) {
              await QuoteItem.update(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: lineTotal(item.quantity, item.unitPrice, item.taxRate),
                },
                { where: { id: item.id }, transaction }
              );
            } else {
              await QuoteItem.create(
                {
                  quoteId: id,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: lineTotal(item.quantity, item.unitPrice, item.taxRate),
                },
                { transaction }
              );
            }
          }
        }
      }

      if (validatedData.items) {
        const updatedItems = await QuoteItem.findAll({ where: { quoteId: id }, transaction });
        const totalAmount = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
        await quote.update({ totalAmount }, { transaction });
      }

      await transaction.commit();

      const updatedQuote = await Quote.findOne({
        where: { id, tenantId },
        include: [
          { model: Customer, as: 'customer', attributes: [...CUSTOMER_ATTRS] },
          { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
          {
            model: QuoteItem,
            as: 'quoteItems',
            include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit'] }],
          },
        ],
      });

      return this.mapToResponseDto(updatedQuote!, updatedQuote!.quoteItems);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteQuote(id: number, tenantId: number): Promise<void> {
    const quote = await Quote.findOne({ where: { id, tenantId } });
    if (!quote) {
      throw new NotFoundError('Quote not found');
    }
    await quote.destroy();
  }

  async getDeletedQuotes(tenantId: number): Promise<QuoteResponseDto[]> {
    const quotes = await Quote.findAll({
      where: { tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
      order: [['deletedAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: [...CUSTOMER_ATTRS] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
      ],
    });
    return quotes.map(q => this.mapToResponseDto(q, []));
  }

  async restoreQuote(id: number, tenantId: number): Promise<QuoteResponseDto> {
    const quote = await Quote.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!quote) throw new NotFoundError('Quote not found in trash');
    await quote.restore();
    return this.mapToResponseDto(quote, []);
  }

  async hardDeleteQuote(id: number, tenantId: number): Promise<void> {
    const quote = await Quote.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!quote) throw new NotFoundError('Quote not found in trash');
    await QuoteItem.destroy({ where: { quoteId: id }, force: true });
    await quote.destroy({ force: true });
  }

  async searchQuotes(searchData: SearchQuoteDto, tenantId: number): Promise<QuoteResponseDto[]> {
    const validatedData = validateSchema(searchQuoteSchema, searchData) as SearchQuoteDto;

    const quotes = await Quote.findAll({
      where: {
        tenantId,
        [Op.or]: [{ quoteNumber: { [Op.like]: `%${validatedData.q}%` } }],
      },
      include: [
        { model: Customer, as: 'customer', attributes: [...CUSTOMER_ATTRS] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
        {
          model: QuoteItem,
          as: 'quoteItems',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return quotes.map(quote => this.mapToResponseDto(quote, quote.quoteItems));
  }

  async getQuotesByCustomer(customerId: number, query: PaginationQuery, tenantId: number): Promise<QuotesListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Quote.findAndCountAll({
      distinct: true,
      where: { tenantId, customerId },
      include: [
        { model: Customer, as: 'customer', attributes: [...CUSTOMER_ATTRS] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
        {
          model: QuoteItem,
          as: 'quoteItems',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit'] }],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const quotes = rows.map(quote => this.mapToResponseDto(quote, quote.quoteItems));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      quotes,
      pagination: { page: validatedPage, limit: validatedLimit, total: Number(count), totalPages },
    };
  }

  /**
   * Convierte una cotización en una orden real, con un solo clic.
   * Reaprovecha OrderService.createOrder() íntegramente — misma numeración ORD-XXXX,
   * misma transacción, y mismo descuento de stock vía StockMovementService (aquí SÍ
   * corresponde descontar stock: en este punto ya es una venta real). Mismo patrón que
   * PosService.sale() ya usa para el mismo motivo.
   *
   * La cotización se marca 'converted' después de que la orden ya fue committeada. Si ese
   * segundo paso falla, se loggea pero NO se revierte la orden (mismo nivel de tolerancia
   * a fallos que el patrón ya existente de stock-movement en order.service.ts) — el
   * usuario puede verificar en /orders que la orden sí se creó.
   */
  async convertToOrder(id: number, userId: number, tenantId: number): Promise<OrderResponseDto> {
    const quote = await Quote.findOne({
      where: { id, tenantId },
      include: [{ model: QuoteItem, as: 'quoteItems' }],
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    if (quote.status === 'converted' || quote.convertedOrderId != null) {
      throw new ConflictError('La cotización ya fue convertida a orden');
    }

    if (!quote.quoteItems || quote.quoteItems.length === 0) {
      throw new BadRequestError('La cotización no tiene productos para convertir');
    }

    const order = await this.orderService.createOrder(
      {
        customerId: quote.customerId,
        source: 'orders',
        status: 'pending',
        paymentType: 'cash',
        notes: quote.notes
          ? `Generada desde cotización ${quote.quoteNumber}\n${quote.notes}`
          : `Generada desde cotización ${quote.quoteNumber}`,
        items: quote.quoteItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        })),
      } as any,
      userId,
      tenantId,
    );

    try {
      await quote.update({ status: 'converted', convertedOrderId: order.id });
    } catch (error) {
      logger.error(
        `Quote ${quote.id} converted to order ${order.id} but failed to mark quote as converted:`,
        error as Error
      );
    }

    return order;
  }

  private mapToResponseDto(quote: Quote, quoteItems?: QuoteItem[]): QuoteResponseDto {
    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      userId: quote.userId,
      totalAmount: Number(quote.totalAmount),
      status: quote.status,
      notes: quote.notes,
      validUntil: quote.validUntil,
      convertedOrderId: quote.convertedOrderId,
      ...(quote.customer && {
        customer: {
          id: quote.customer.id,
          name: quote.customer.name,
          nit: quote.customer.nit,
          contact: quote.customer.contact,
          address: quote.customer.address,
        }
      }),
      ...(quote.user && {
        user: {
          id: quote.user.id,
          username: quote.user.username,
          role: quote.user.role,
        }
      }),
      items: (quoteItems || []).map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        taxRate: Number(item.taxRate),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        ...(item.product && {
          product: {
            id: item.product.id,
            name: item.product.name,
            code: item.product.code,
            unit: item.product.unit,
          }
        }),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }
}
