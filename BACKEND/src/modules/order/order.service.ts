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

  // Registrar un abono parcial; si completa el total, marca la orden pagada
  async addPayment(orderId: number, tenantId: number, userId: number, amount: number, notes?: string) {
    const { OrderPayment } = await import('./order-payment.model');
    const order = await Order.findOne({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.paymentType !== 'credit') throw new NotFoundError('La orden no es a crédito');
    if (amount <= 0) throw new NotFoundError('El abono debe ser mayor a 0');

    await OrderPayment.create({ tenantId, orderId, amount, notes: notes ?? null, userId });

    const paid = Number(await OrderPayment.sum('amount', { where: { orderId } })) || 0;
    const total = Number(order.totalAmount);
    if (paid >= total - 0.01 && !order.paidAt) {
      await order.update({ paidAt: new Date() });
    }
    logger.info(`Abono $${amount} a orden ${order.orderNumber} (pagado ${paid}/${total})`);
    return { paidAmount: paid, balance: Math.max(0, total - paid), paidAt: order.paidAt };
  }

  async getPayments(orderId: number, tenantId: number) {
    const { OrderPayment } = await import('./order-payment.model');
    const order = await Order.findOne({ where: { id: orderId, tenantId }, attributes: ['id', 'totalAmount', 'paidAt'] });
    if (!order) throw new NotFoundError('Order not found');
    const payments = await OrderPayment.findAll({ where: { orderId }, order: [['createdAt', 'ASC']], raw: true });
    const paidAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    return { payments, paidAmount, balance: Math.max(0, Number(order.totalAmount) - paidAmount) };
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

    // Abonos por orden — el saldo real es total - abonado
    const { OrderPayment } = await import('./order-payment.model');
    const sums = orders.length
      ? await OrderPayment.findAll({
          where: { orderId: orders.map(o => o.id) },
          attributes: ['orderId', [sequelize.fn('SUM', sequelize.col('amount')), 'paid']],
          group: ['orderId'],
          raw: true,
        }) as unknown as Array<{ orderId: number; paid: string }>
      : [];
    const paidMap = new Map(sums.map(s => [s.orderId, Number(s.paid)]));

    let totalDue = 0;
    let overdueCount = 0;
    const items = orders.map(o => {
      const total = Number(o.totalAmount);
      const paidAmount = paidMap.get(o.id) ?? 0;
      const balance = Math.max(0, total - paidAmount);
      totalDue += balance;
      const due = o.paymentDueDate ? new Date(`${o.paymentDueDate}T00:00:00`) : null;
      const daysUntilDue = due ? Math.round((due.getTime() - today.getTime()) / 86400000) : null;
      if (daysUntilDue !== null && daysUntilDue < 0) overdueCount++;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: total,
        paidAmount,
        balance,
        paymentDueDate: o.paymentDueDate,
        daysUntilDue,
        customer: o.customer ? { id: o.customer.id, name: o.customer.name } : null,
      };
    });

    return { totalDue, count: items.length, overdueCount, orders: items };
  }

  // Costo por producto: último costo de compra; si no hay, el menor precio de proveedor
  private async getProductCostMap(tenantId: number): Promise<Map<number, number>> {
    const { PurchaseOrder } = await import('@/modules/purchase-order/purchase-order.model');
    const { PurchaseOrderItem } = await import('@/modules/purchase-order/purchase-order-item/purchase-order-item.model');
    const { Price } = await import('@/modules/price/price.model');

    const costMap = new Map<number, number>();

    // Último costo de compra por producto (incluye compras históricas affectsStock=false)
    const poItems = await PurchaseOrderItem.findAll({
      include: [{
        model: PurchaseOrder,
        as: 'purchaseOrder',
        attributes: [],
        where: { tenantId, status: { [Op.ne]: 'cancelled' } },
        required: true,
      }],
      attributes: ['productId', 'unitCost', 'createdAt'],
      order: [['createdAt', 'DESC']],
      raw: true,
    }) as unknown as Array<{ productId: number; unitCost: string }>;
    for (const it of poItems) {
      if (!costMap.has(it.productId)) costMap.set(it.productId, Number(it.unitCost));
    }

    // Fallback: menor precio de proveedor registrado
    const prices = await Price.findAll({
      where: { tenantId },
      attributes: ['productId', [sequelize.fn('MIN', sequelize.col('price')), 'minPrice']],
      group: ['productId'],
      raw: true,
    }) as unknown as Array<{ productId: number; minPrice: string }>;
    for (const p of prices) {
      if (!costMap.has(p.productId)) costMap.set(p.productId, Number(p.minPrice));
    }

    return costMap;
  }

  // Rentabilidad real: utilidad = venta de items − costo de lo vendido (COGS),
  // NO ventas − compras del período (eso castiga la carga de inventario)
  async getProfitStats(tenantId: number) {
    const { PurchaseOrder } = await import('@/modules/purchase-order/purchase-order.model');
    const costMap = await this.getProductCostMap(tenantId);

    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const items = await OrderItem.findAll({
      include: [{
        model: Order,
        as: 'order',
        attributes: ['createdAt'],
        where: { tenantId, status: { [Op.ne]: 'cancelled' }, createdAt: { [Op.gte]: since } },
        required: true,
      }],
      attributes: ['productId', 'quantity', 'unitPrice'],
      raw: true,
      nest: true,
    }) as unknown as Array<{ productId: number; quantity: number; unitPrice: string; order: { createdAt: Date } }>;

    const byMonth = new Map<string, { revenue: number; cogs: number }>();
    const noCost = new Set<number>();
    for (const it of items) {
      const month = new Date(it.order.createdAt).toISOString().slice(0, 7);
      const entry = byMonth.get(month) ?? { revenue: 0, cogs: 0 };
      const qty = Number(it.quantity);
      entry.revenue += qty * Number(it.unitPrice);
      const cost = costMap.get(it.productId);
      if (cost === undefined) noCost.add(it.productId);
      entry.cogs += qty * (cost ?? 0);
      byMonth.set(month, entry);
    }

    const months = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: Math.round(v.revenue),
        cogs: Math.round(v.cogs),
        profit: Math.round(v.revenue - v.cogs),
        margin: v.revenue > 0 ? Math.round(((v.revenue - v.cogs) / v.revenue) * 1000) / 10 : 0,
      }));

    const nowMonth = new Date().toISOString().slice(0, 7);
    const current = months.find(m => m.month === nowMonth) ?? { month: nowMonth, revenue: 0, cogs: 0, profit: 0, margin: 0 };

    // Compras del mes: informativo (flujo de caja), NO se resta de la utilidad
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const purchasesThisMonth = Number(await PurchaseOrder.sum('totalAmount', {
      where: { tenantId, status: 'received', createdAt: { [Op.gte]: startOfMonth } },
    })) || 0;

    return { months, current, purchasesThisMonth, productsWithoutCost: noCost.size };
  }

  // Reporte mensual de ventas en CSV (abre en Excel)
  async getMonthlyReportCsv(tenantId: number, month: string): Promise<{ filename: string; csv: string }> {
    const costMap = await this.getProductCostMap(tenantId);
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const orders = await Order.findAll({
      where: { tenantId, createdAt: { [Op.gte]: start, [Op.lt]: end } },
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: OrderItem, as: 'orderItems', attributes: ['productId', 'quantity', 'unitPrice'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const num = (n: number) => Math.round(n);
    const rows = [
      ['Orden', 'Fecha', 'Cliente', 'Estado', 'Pago', 'Total venta', 'Costo estimado', 'Utilidad', 'Margen %'].join(';'),
    ];

    let tRev = 0, tCost = 0;
    for (const o of orders) {
      const items = o.orderItems ?? [];
      const rev = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
      const cost = items.reduce((s, it) => s + Number(it.quantity) * (costMap.get(it.productId) ?? 0), 0);
      const cancelled = o.status === 'cancelled';
      if (!cancelled) { tRev += rev; tCost += cost; }
      rows.push([
        esc(o.orderNumber),
        esc(new Date(o.createdAt).toLocaleDateString('es-CO')),
        esc(o.customer?.name ?? ''),
        esc(o.status),
        esc(o.paymentType === 'credit' ? (o.paidAt ? 'crédito (pagada)' : 'crédito (pendiente)') : 'contado'),
        num(Number(o.totalAmount)),
        cancelled ? 0 : num(cost),
        cancelled ? 0 : num(rev - cost),
        !cancelled && rev > 0 ? (((rev - cost) / rev) * 100).toFixed(1) : '0',
      ].join(';'));
    }
    rows.push('');
    rows.push(['TOTALES (sin canceladas)', '', '', '', '', num(tRev), num(tCost), num(tRev - tCost),
      tRev > 0 ? (((tRev - tCost) / tRev) * 100).toFixed(1) : '0'].join(';'));

    // BOM para que Excel abra acentos bien
    return { filename: `reporte-ventas-${month}.csv`, csv: '﻿' + rows.join('\r\n') };
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