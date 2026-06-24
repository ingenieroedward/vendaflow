import sequelize from '@/database';
import { Transaction } from 'sequelize';
import { PurchaseOrder } from './purchase-order.model';
import { PurchaseOrderItem } from './purchase-order-item/purchase-order-item.model';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { User } from '@/modules/user/user.model';
import { StockMovementService } from '@/modules/stock-movement/stock-movement.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  PurchaseOrderResponseDto,
  PurchaseOrdersListResponseDto,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from './purchase-order.dto';
import { NotFoundError, BadRequestError } from '@/core/errors/AppError';
import { validateSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import logger from '@/core/logger';

export class PurchaseOrderService {
  private stockMovementService = new StockMovementService();

  private async generatePoNumber(): Promise<string> {
    const last = await PurchaseOrder.findOne({
      order: [['id', 'DESC']],
      paranoid: false,
    });
    if (!last) return 'POC-01';
    const match = last.poNumber.match(/POC-(\d+)/);
    if (!match || !match[1]) return 'POC-01';
    const next = parseInt(match[1], 10) + 1;
    return `POC-${String(next).padStart(2, '0')}`;
  }

  async createPurchaseOrder(data: CreatePurchaseOrderDto, userId: number): Promise<PurchaseOrderResponseDto> {
    const validatedData = validateSchema(createPurchaseOrderSchema, data);

    const supplier = await Supplier.findByPk(validatedData.supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    for (const item of validatedData.items) {
      const product = await Product.findByPk(item.productId);
      if (!product) throw new NotFoundError(`Product with ID ${item.productId} not found`);
    }

    let poNumberBase = validatedData.poNumber;
    let attempts = 0;

    while (attempts < 3) {
      try {
        const poNumber: string = poNumberBase ?? await this.generatePoNumber();

        const purchaseOrder = await sequelize.transaction(async (t: Transaction) => {
          const totalAmount = validatedData.items.reduce(
            (sum, item) => sum + item.quantity * item.unitCost,
            0,
          );

          const po = await PurchaseOrder.create(
            {
              poNumber,
              supplierId: validatedData.supplierId,
              userId,
              totalAmount,
              status: validatedData.status ?? 'draft',
              notes: validatedData.notes ?? null,
            },
            { transaction: t },
          );

          for (const item of validatedData.items) {
            await PurchaseOrderItem.create(
              {
                purchaseOrderId: po.id,
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.quantity * item.unitCost,
              },
              { transaction: t },
            );
          }

          // If created directly as received, update stock immediately
          if (po.status === 'received') {
            for (const item of validatedData.items) {
              await this.stockMovementService.createMovement({
                productId: item.productId,
                type: 'purchase',
                quantity: item.quantity,
                referenceId: po.id,
                referenceType: 'purchase_order',
                userId,
                notes: `Orden de compra ${po.poNumber}`,
                transaction: t,
              });
            }
          }

          return po;
        });

        const full = await this.getPurchaseOrderById(purchaseOrder.id);
        return full;
      } catch (error: any) {
        if (error?.name === 'SequelizeUniqueConstraintError') {
          poNumberBase = undefined;
          attempts++;
          logger.warn(`POC number collision, retrying (attempt ${attempts})`);
        } else {
          throw error;
        }
      }
    }

    throw new BadRequestError('Could not generate unique PO number');
  }

  async getAllPurchaseOrders(query: PaginationQuery): Promise<PurchaseOrdersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'contact', 'location'] },
        { model: User, as: 'user', attributes: ['id', 'username'] },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit', 'stock'] }],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      purchaseOrders: rows.map(po => this.mapToResponseDto(po)),
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / validatedLimit),
      },
    };
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrderResponseDto> {
    const po = await PurchaseOrder.findOne({
      where: { id },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'contact', 'location'] },
        { model: User, as: 'user', attributes: ['id', 'username'] },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'code', 'unit', 'stock'] }],
        },
      ],
    });
    if (!po) throw new NotFoundError('Purchase order not found');
    return this.mapToResponseDto(po);
  }

  async updatePurchaseOrder(id: number, data: UpdatePurchaseOrderDto, userId: number): Promise<PurchaseOrderResponseDto> {
    const validatedData = validateSchema(updatePurchaseOrderSchema, data);
    const po = await PurchaseOrder.findByPk(id, {
      include: [{ model: PurchaseOrderItem, as: 'items' }],
    });
    if (!po) throw new NotFoundError('Purchase order not found');

    if (po.status === 'received' || po.status === 'cancelled') {
      throw new BadRequestError(`Cannot modify a purchase order with status "${po.status}"`);
    }

    const newStatus = validatedData.status ?? po.status;

    await sequelize.transaction(async (t: Transaction) => {
      const totalAmount = validatedData.items
        ? validatedData.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
        : Number(po.totalAmount);

      await po.update(
        {
          supplierId: validatedData.supplierId ?? po.supplierId,
          status: newStatus,
          notes: validatedData.notes !== undefined ? validatedData.notes : po.notes,
          totalAmount,
        },
        { transaction: t },
      );

      if (validatedData.items) {
        const existingItems = po.items ?? [];
        const incomingIds = validatedData.items.filter(i => i.id).map(i => i.id!);

        // Remove items not in the update
        for (const existing of existingItems) {
          if (!incomingIds.includes(existing.id)) {
            await existing.destroy({ transaction: t });
          }
        }

        for (const item of validatedData.items) {
          if (item.id) {
            const existing = existingItems.find(e => e.id === item.id);
            if (existing) {
              await existing.update(
                { quantity: item.quantity, unitCost: item.unitCost, totalCost: item.quantity * item.unitCost },
                { transaction: t },
              );
            }
          } else {
            const product = await Product.findByPk(item.productId);
            if (!product) throw new NotFoundError(`Product ${item.productId} not found`);
            await PurchaseOrderItem.create(
              {
                purchaseOrderId: po.id,
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.quantity * item.unitCost,
              },
              { transaction: t },
            );
          }
        }
      }

      // When transitioning to 'received', add stock for all items
      if (newStatus === 'received') {
        const currentItems = await PurchaseOrderItem.findAll({ where: { purchaseOrderId: po.id }, transaction: t });
        for (const item of currentItems) {
          await this.stockMovementService.createMovement({
            productId: item.productId,
            type: 'purchase',
            quantity: item.quantity,
            referenceId: po.id,
            referenceType: 'purchase_order',
            userId,
            notes: `Orden de compra ${po.poNumber} recibida`,
            transaction: t,
          });
        }
      }
    });

    return this.getPurchaseOrderById(id);
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    const po = await PurchaseOrder.findByPk(id);
    if (!po) throw new NotFoundError('Purchase order not found');
    if (po.status === 'received') throw new BadRequestError('Cannot delete a received purchase order');
    await po.destroy();
  }

  private mapToResponseDto(po: PurchaseOrder): PurchaseOrderResponseDto {
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      userId: po.userId,
      totalAmount: Number(po.totalAmount),
      status: po.status,
      notes: po.notes,
      supplier: po.supplier
        ? { id: po.supplier.id, name: po.supplier.name, contact: po.supplier.contact, location: po.supplier.location }
        : undefined,
      user: po.user ? { id: po.user.id, username: po.user.username } : undefined,
      items: (po.items ?? []).map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        totalCost: Number(item.totalCost),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              code: item.product.code,
              unit: item.product.unit,
              stock: Number(item.product.stock),
            }
          : undefined,
      })),
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    };
  }
}
