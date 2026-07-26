import { Order, OrderAttributes } from './order.model';
import { OrderItem, OrderItemAttributes } from './order-item.model';
import { Customer } from '@/modules/customer/customer.model';
import { User } from '@/modules/user/user.model';
import { Product } from '@/modules/product/product.model';
import { 
  CreateOrderDto, 
  UpdateOrderDto, 
  OrderResponseDto, 
  OrdersListResponseDto,
  SearchOrderDto
} from './order.dto';
import { NotFoundError } from '@/core/errors/AppError';
import logger from '@/core/logger';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createOrderSchema, updateOrderSchema, searchOrderSchema } from './order.dto';
import { Op, UniqueConstraintError, literal } from 'sequelize';
import sequelize from '@/database';
import { StockMovementService } from '@/modules/stock-movement/stock-movement.service';

export class OrderService {
  private stockMovementService = new StockMovementService();
  /**
   * Genera el siguiente número de orden en formato ORD-XX (ej: ORD-01, ORD-11).
   * Busca la última orden existente (incluyendo soft-deleted) y suma 1.
   * El contador empieza en 1. Si ocurre algún error usa el timestamp como fallback.
   */
  private async generateOrderNumber(): Promise<string> {
    try {
      // Numeric MAX to avoid alphabetical sort issues with ORD-9X > ORD-1XX
      const result = await Order.findOne({
        attributes: [[literal('MAX(CAST(SUBSTRING(orderNumber, 5) AS UNSIGNED))'), 'maxNum']],
        where: { orderNumber: { [Op.like]: 'ORD-%' } },
        paranoid: false,
        raw: true,
      }) as any;

      const maxNum = result?.maxNum ?? 0;
      const nextNumber = (parseInt(String(maxNum)) || 0) + 1;
      return `ORD-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      logger.error('Error generating order number:', error as Error);
      return `ORD-${Date.now()}`;
    }
  }

  /**
   * Crea una nueva orden con sus items.
   * Valida la existencia de cliente, usuario y todos los productos antes de persistir.
   * Los items se crean en paralelo con Promise.all (no usa transacción — si falla un item
   * la orden queda huérfana; considerar envolver en transacción si esto es crítico).
   * Si no se provee orderNumber, lo genera automáticamente.
   */
  async createOrder(orderData: CreateOrderDto, userId: number, tenantId: number): Promise<OrderResponseDto> {
    const validatedData = validateSchema(createOrderSchema, orderData);

    // Check if customer exists
    const customer = await Customer.findByPk(validatedData.customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if all products exist
    for (const item of validatedData.items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId} not found`);
      }
    }

    // Calculate total amount
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // Create order + items inside a transaction, retrying up to 3 times on duplicate order number
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = validatedData.orderNumber ?? await this.generateOrderNumber();
      const t = await sequelize.transaction();
      try {
        const order = await Order.create({
          tenantId,
          orderNumber,
          customerId: validatedData.customerId,
          userId,
          totalAmount,
          status: validatedData.status,
          notes: validatedData.notes,
          paymentType: validatedData.paymentType,
          paymentDueDate: validatedData.paymentType === 'credit' ? validatedData.paymentDueDate ?? null : null,
          reminderDays: validatedData.paymentType === 'credit' ? validatedData.reminderDays ?? 3 : null,
          paidAt: null,
        } as OrderAttributes, { transaction: t });

        const orderItems = await Promise.all(
          validatedData.items.map(item =>
            OrderItem.create({
              orderId: order.id,
              taxRate: item.taxRate,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            } as OrderItemAttributes, { transaction: t })
          )
        );

        // Descontar stock (permite negativo). Tolerante a fallos: si la tabla
        // stock_movements aún no existe en producción, la orden igual se crea.
        try {
          for (const item of validatedData.items) {
            await this.stockMovementService.createMovement({
              tenantId,
              productId: item.productId,
              type: 'sale',
              quantity: -item.quantity,
              referenceId: order.id,
              referenceType: 'order',
              userId,
              notes: `Orden de venta ${order.orderNumber}`,
              transaction: t,
            });
          }
        } catch (stockErr) {
          logger.warn('Stock movement skipped (table may not exist yet):', stockErr);
        }

        await t.commit();
        return this.mapToResponseDto(order, orderItems);
      } catch (err) {
        await t.rollback();
        // Retry only on duplicate order number; re-throw anything else immediately
        if (err instanceof UniqueConstraintError && !validatedData.orderNumber && attempt < 2) {
          logger.warn(`Order number collision on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate a unique order number after 3 attempts');
  }

  async getNextOrderNumber(): Promise<{ nextOrderNumber: string }> {
    const nextNumber = await this.generateOrderNumber();
    return { nextOrderNumber: nextNumber };
  }

  // Marcar una orden a crédito como pagada (o revertir con paid=false)
  async markPaid(id: number, tenantId: number, paid: boolean): Promise<OrderResponseDto> {
    const order = await Order.findOne({
      where: { id, tenantId },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'contact', 'address'] }],
    });
    if (!order) throw new NotFoundError('Order not found');

    await order.update({ paidAt: paid ? new Date() : null });
    logger.info(`Order ${order.orderNumber} marked as ${paid ? 'paid' : 'unpaid'} (tenant ${tenantId})`);
    return this.mapToResponseDto(order);
  }

  // Cartera: órdenes a crédito sin pagar, ordenadas por vencimiento
  async getReceivables(tenantId: number) {
    const orders = await Order.findAll({
      where: {
        tenantId,
        paymentType: 'credit',
        paidAt: null,
        status: { [Op.ne]: 'cancelled' },
      },
      attributes: ['id', 'orderNumber', 'totalAmount', 'paymentDueDate', 'reminderDays', 'createdAt'],
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      order: [['paymentDueDate', 'ASC']],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalDue = 0;
    let overdueCount = 0;
    const items = orders.map(o => {
      const total = Number(o.totalAmount);
      totalDue += total;
      const due = o.paymentDueDate ? new Date(`${o.paymentDueDate}T00:00:00`) : null;
      const daysUntilDue = due ? Math.round((due.getTime() - today.getTime()) / 86400000) : null;
      if (daysUntilDue !== null && daysUntilDue < 0) overdueCount++;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: total,
        paymentDueDate: o.paymentDueDate,
        daysUntilDue,
        customer: o.customer ? { id: o.customer.id, name: o.customer.name } : null,
      };
    });

    return { totalDue, count: items.length, overdueCount, orders: items };
  }

  // KPIs del Home: órdenes pendientes, ventas del mes y actividad reciente
  async getHomeStats(tenantId: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [pendingOrders, salesThisMonth, ordersThisMonth, recentOrders] = await Promise.all([
      Order.count({ where: { tenantId, status: ['pending', 'processing'] } }),
      Order.sum('totalAmount', {
        where: {
          tenantId,
          status: { [Op.ne]: 'cancelled' },
          createdAt: { [Op.gte]: startOfMonth },
        },
      }),
      Order.count({ where: { tenantId, createdAt: { [Op.gte]: startOfMonth } } }),
      Order.findAll({
        where: { tenantId },
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'orderNumber', 'status', 'totalAmount', 'createdAt'],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      }),
    ]);

    return {
      pendingOrders,
      salesThisMonth: Number(salesThisMonth) || 0,
      ordersThisMonth,
      recentOrders,
    };
  }

  async getAllOrders(query: PaginationQuery, tenantId: number): Promise<OrdersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Order.findAndCountAll({
      where: { tenantId },
      distinct: true,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'code', 'unit'],
            },
          ],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const orders = rows.map(order => this.mapToResponseDto(order, order.orderItems));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      orders,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getOrderById(id: number, tenantId: number): Promise<OrderResponseDto> {
    const order = await Order.findOne({
      where: { id, tenantId },
      include: [
        {
          model: Customer,
          as: 'customer',
        },
        {
          model: User,
          as: 'user',
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
              as: 'product',
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this.mapToResponseDto(order, order.orderItems);
  }

  /**
   * Actualiza una orden y sincroniza sus items dentro de una transacción DB.
   * Algoritmo de sync de items:
   *  1. Elimina los items que ya no vienen en el payload.
   *  2. Actualiza los items existentes (tienen id).
   *  3. Crea los items nuevos (sin id).
   *  4. Recalcula totalAmount sumando los totalPrice actuales.
   * Si cualquier paso falla, hace rollback completo.
   */
  async updateOrder(id: number, updateData: UpdateOrderDto, tenantId: number): Promise<OrderResponseDto> {
    const validatedData = validatePartialSchema(updateOrderSchema, updateData) as Partial<UpdateOrderDto>;

    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findOne({ where: { id, tenantId }, transaction });
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Al pasar a contado, limpiar los campos de crédito
      if (validatedData.paymentType === 'cash') {
        (validatedData as Record<string, unknown>)['paymentDueDate'] = null;
        (validatedData as Record<string, unknown>)['reminderDays'] = null;
      }

      // Update main order fields
      await order.update(validatedData as any, { transaction });

      // If items are provided, sync them
      if (validatedData.items) {
        // Get current items
        const existingItems = await OrderItem.findAll({ where: { orderId: id }, transaction });
        const existingItemIds = existingItems.map(item => item.id);

        // IDs from update
        const updatedItemIds = validatedData.items.filter(item => !!item.id).map(item => item.id);

        // Delete removed items
        const itemsToDelete = existingItemIds.filter(itemId => !updatedItemIds.includes(itemId));
        if (itemsToDelete.length > 0) {
          await OrderItem.destroy({ where: { id: itemsToDelete }, transaction });
        }

        // Update or create items
        for (const item of validatedData.items) {
          if (
            typeof item.productId === 'number' &&
            typeof item.quantity === 'number' &&
            typeof item.unitPrice === 'number' &&
            typeof item.taxRate === 'number'
          ) {
            if (item.id && existingItemIds.includes(item.id)) {
              // Update existing
              await OrderItem.update(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: item.quantity * item.unitPrice,
                },
                { where: { id: item.id }, transaction }
              );
            } else {
              // Create new
              await OrderItem.create(
                {
                  orderId: id,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: item.quantity * item.unitPrice,
                },
                { transaction }
              );
            }
          }
        }
      }

      // Recalculate totalAmount if items were updated
      if (validatedData.items) {
        const updatedItems = await OrderItem.findAll({ where: { orderId: id }, transaction });
        const totalAmount = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
        await order.update({ totalAmount }, { transaction });
      }

      await transaction.commit();

      const updatedOrder = await Order.findOne({
        where: { id, tenantId },
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'contact', 'address'],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'role'],
          },
          {
            model: OrderItem,
            as: 'orderItems',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'code', 'unit'],
              },
            ],
          },
        ],
      });

      return this.mapToResponseDto(updatedOrder!, updatedOrder!.orderItems);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteOrder(id: number, tenantId: number): Promise<void> {
    const order = await Order.findOne({ where: { id, tenantId } });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    await order.destroy();
  }

  async getDeletedOrders(tenantId: number): Promise<OrderResponseDto[]> {
    const orders = await Order.findAll({
      where: { tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
      order: [['deletedAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'contact', 'address'] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
      ],
    });
    return orders.map(o => this.mapToResponseDto(o, []));
  }

  async restoreOrder(id: number, tenantId: number): Promise<OrderResponseDto> {
    const order = await Order.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!order) throw new NotFoundError('Order not found in trash');
    await order.restore();
    return this.mapToResponseDto(order, []);
  }

  async hardDeleteOrder(id: number, tenantId: number): Promise<void> {
    const order = await Order.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!order) throw new NotFoundError('Order not found in trash');
    await OrderItem.destroy({ where: { orderId: id }, force: true });
    await order.destroy({ force: true });
  }

  async searchOrders(searchData: SearchOrderDto, tenantId: number): Promise<OrderResponseDto[]> {
    const validatedData = validateSchema(searchOrderSchema, searchData) as SearchOrderDto;

    const orders = await Order.findAll({
      where: {
        tenantId,
        [Op.or]: [
          { orderNumber: { [Op.like]: `%${validatedData.q}%` } },
        ],
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'code', 'unit'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return orders.map(order => this.mapToResponseDto(order, order.orderItems));
  }

  async getOrdersByCustomer(customerId: number, query: PaginationQuery, tenantId: number): Promise<OrdersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Order.findAndCountAll({
      distinct: true,
      where: { tenantId, customerId },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'code', 'unit'],
            },
          ],
        },
      ],
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const orders = rows.map(order => this.mapToResponseDto(order, order.orderItems));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      orders,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  private mapToResponseDto(order: Order, orderItems?: OrderItem[]): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      userId: order.userId,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      notes: order.notes,
      paymentType: order.paymentType ?? 'cash',
      paymentDueDate: order.paymentDueDate ?? null,
      reminderDays: order.reminderDays ?? null,
      paidAt: order.paidAt ?? null,
      ...(order.customer && {
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          contact: order.customer.contact,
          address: order.customer.address,
        }
      }),
      ...(order.user && {
        user: {
          id: order.user.id,
          username: order.user.username,
          role: order.user.role,
        }
      }),
      items: (orderItems || []).map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        taxRate: item.taxRate,
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
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}