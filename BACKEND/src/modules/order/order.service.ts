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
import { NotFoundError, ConflictError, BadRequestError } from '@/core/errors/AppError';
import logger from '@/core/logger';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createOrderSchema, updateOrderSchema, searchOrderSchema } from './order.dto';
import { Op, UniqueConstraintError, literal, fn, col } from 'sequelize';
import sequelize from '@/database';
import { StockMovementService } from '@/modules/stock-movement/stock-movement.service';

export class OrderService {
  private stockMovementService = new StockMovementService();
  /**
   * Genera el siguiente número de orden en formato ORD-XX (ej: ORD-01, ORD-11).
   * Busca la última orden existente (incluyendo soft-deleted) y suma 1.
   * El contador empieza en 1. Si ocurre algún error usa el timestamp como fallback.
   */
  private async generateOrderNumber(tenantId: number): Promise<string> {
    try {
      // Numeric MAX to avoid alphabetical sort issues with ORD-9X > ORD-1XX
      const result = await Order.findOne({
        attributes: [[literal('MAX(CAST(SUBSTRING(orderNumber, 5) AS UNSIGNED))'), 'maxNum']],
        where: { tenantId, orderNumber: { [Op.like]: 'ORD-%' } },
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

    // Idempotencia: si este clientRef ya creó una orden (reintento tras timeout,
    // doble pestaña sincronizando), devolver la existente en vez de duplicar
    if (validatedData.clientRef) {
      const existing = await Order.findOne({
        where: { tenantId, clientRef: validatedData.clientRef },
        paranoid: false,
      });
      if (existing) {
        const items = await OrderItem.findAll({ where: { orderId: existing.id } });
        return this.mapToResponseDto(existing, items);
      }
    }

    // Cuota mensual del plan
    const { Tenant } = await import('@/modules/tenant/tenant.model');
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const count = await Order.count({ where: { tenantId, createdAt: { [Op.gte]: monthStart } } });
      if (count >= tenant.maxOrdersPerMonth) {
        throw new ConflictError(`Tu plan permite máximo ${tenant.maxOrdersPerMonth} órdenes por mes. Actualiza el plan para continuar.`);
      }
    }

    // Check if customer exists (del mismo tenant)
    const customer = await Customer.findOne({ where: { id: validatedData.customerId, tenantId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if all products exist (del mismo tenant)
    for (const item of validatedData.items) {
      const product = await Product.findOne({ where: { id: item.productId, tenantId } });
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId} not found`);
      }
    }

    // Calculate total amount — incluye IVA por línea, igual que la factura
    // que ve el cliente (antes se guardaba sin IVA y cartera/pagos quedaban cortos)
    const lineTotal = (qty: number, price: number, taxRate: number) =>
      Math.round(qty * price * (1 + (taxRate || 0) / 100) * 100) / 100;
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + lineTotal(item.quantity, item.unitPrice, item.taxRate);
    }, 0);

    // Create order + items inside a transaction, retrying up to 3 times on duplicate order number
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = validatedData.orderNumber ?? await this.generateOrderNumber(tenantId);
      const t = await sequelize.transaction();
      try {
        const order = await Order.create({
          tenantId,
          orderNumber,
          clientRef: validatedData.clientRef ?? null,
          source: validatedData.source,
          cashSessionId: validatedData.source === 'pos' ? validatedData.cashSessionId ?? null : null,
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
              totalPrice: lineTotal(item.quantity, item.unitPrice, item.taxRate),
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
              notes: `${validatedData.source === 'pos' ? 'Venta POS' : 'Orden de venta'} ${order.orderNumber}`,
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

  async getNextOrderNumber(tenantId: number): Promise<{ nextOrderNumber: string }> {
    const nextNumber = await this.generateOrderNumber(tenantId);
    return { nextOrderNumber: nextNumber };
  }

  // Registrar un abono parcial; si completa el total, marca la orden pagada
  async addPayment(orderId: number, tenantId: number, userId: number, amount: number, notes?: string) {
    const { OrderPayment } = await import('./order-payment.model');
    const order = await Order.findOne({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.paymentType !== 'credit') throw new BadRequestError('La orden no es a crédito');
    if (order.status === 'cancelled') throw new BadRequestError('La orden está cancelada — no admite abonos');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestError('El abono debe ser un monto mayor a 0');

    const alreadyPaid = Number(await OrderPayment.sum('amount', { where: { orderId } })) || 0;
    const balance = Number(order.totalAmount) - alreadyPaid;
    if (amount > balance + 0.01) {
      throw new BadRequestError(`El abono ($${amount.toLocaleString('es-CO')}) supera el saldo pendiente ($${Math.max(0, balance).toLocaleString('es-CO')})`);
    }

    await OrderPayment.create({ tenantId, orderId, amount, notes: (notes ?? '').slice(0, 255) || null, userId });

    const paid = Number(await OrderPayment.sum('amount', { where: { orderId } })) || 0;
    const total = Number(order.totalAmount);
    if (paid >= total - 0.01 && !order.paidAt) {
      await order.update({ paidAt: new Date() });
    }
    logger.info(`Abono $${amount} a orden ${order.orderNumber} (pagado ${paid}/${total})`);
    return { paidAmount: paid, balance: Math.max(0, total - paid), paidAt: order.paidAt };
  }

  // Eliminar un abono mal registrado (solo admin) — recalcula paidAt
  async deletePayment(orderId: number, paymentId: number, tenantId: number) {
    const { OrderPayment } = await import('./order-payment.model');
    const order = await Order.findOne({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundError('Order not found');
    const payment = await OrderPayment.findOne({ where: { id: paymentId, orderId, tenantId } });
    if (!payment) throw new NotFoundError('Abono no encontrado');
    await payment.destroy();
    const paid = Number(await OrderPayment.sum('amount', { where: { orderId } })) || 0;
    const fullyPaid = paid >= Number(order.totalAmount) - 0.01;
    if (!fullyPaid && order.paidAt) await order.update({ paidAt: null });
    return { paidAmount: paid, balance: Math.max(0, Number(order.totalAmount) - paid) };
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
  /**
   * Reporte mensual en Excel (.xlsx) con 4 hojas: Resumen, Órdenes,
   * Productos y Clientes. Utilidad sobre base sin IVA; totales con IVA.
   */
  async getMonthlyReportXlsx(tenantId: number, month: string): Promise<{ filename: string; buffer: Buffer }> {
    const ExcelJS = (await import('exceljs')).default;
    const { OrderPayment } = await import('./order-payment.model');
    const costMap = await this.getProductCostMap(tenantId);
    const start = new Date(`${month}-01T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const orders = await Order.findAll({
      where: { tenantId, createdAt: { [Op.gte]: start, [Op.lt]: end } },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['username'] },
        {
          model: OrderItem,
          as: 'orderItems',
          attributes: ['productId', 'quantity', 'unitPrice', 'taxRate', 'totalPrice'],
          include: [{ model: Product, as: 'product', attributes: ['name', 'code', 'unit', 'stock'] }],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    // Abonos de las órdenes del mes (para columna Abonado/Saldo)
    const orderIds = orders.map(o => o.id);
    const paidRows = orderIds.length
      ? await OrderPayment.findAll({
          where: { orderId: orderIds },
          attributes: ['orderId', [fn('SUM', col('amount')), 'paid']],
          group: ['orderId'],
          raw: true,
        }) as unknown as Array<{ orderId: number; paid: string }>
      : [];
    const paidMap = new Map(paidRows.map(r => [r.orderId, Number(r.paid)]));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Merco';
    wb.created = new Date();

    // Resumen se crea primero (queda como primera hoja) y se llena al final
    const wsRes = wb.addWorksheet('Resumen');

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0F172A' } },
      alignment: { vertical: 'middle' as const },
    };
    const money = '#,##0';
    const pct = '0.0%';
    const styleHeader = (sheet: import('exceljs').Worksheet) => {
      const row = sheet.getRow(1);
      row.height = 22;
      row.eachCell(c => { c.font = headerStyle.font; c.fill = headerStyle.fill; c.alignment = headerStyle.alignment; });
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
    };

    // ── Acumuladores ──
    type ProdAgg = { name: string; code: string; unit: string; stock: number; qty: number; revenue: number; cost: number };
    type CustAgg = { name: string; orders: number; total: number; base: number; profit: number; balance: number };
    const prodAgg = new Map<number, ProdAgg>();
    const custAgg = new Map<number, CustAgg>();
    let tBase = 0, tTax = 0, tTotal = 0, tCost = 0, cancelledCount = 0;
    let cashCount = 0, cashTotal = 0, creditCount = 0, creditTotal = 0, creditPaid = 0, creditBalance = 0;

    // ── Hoja 2: Órdenes ──
    const wsOrders = wb.addWorksheet('Órdenes');
    wsOrders.columns = [
      { header: 'Orden', key: 'n', width: 12 },
      { header: 'Fecha', key: 'f', width: 12 },
      { header: 'Cliente', key: 'c', width: 28 },
      { header: 'Vendedor', key: 'v', width: 16 },
      { header: 'Estado', key: 'e', width: 12 },
      { header: 'Tipo de pago', key: 'tp', width: 18 },
      { header: 'Base (sin IVA)', key: 'b', width: 15, style: { numFmt: money } },
      { header: 'IVA', key: 'i', width: 12, style: { numFmt: money } },
      { header: 'Total facturado', key: 't', width: 15, style: { numFmt: money } },
      { header: 'Abonado', key: 'a', width: 13, style: { numFmt: money } },
      { header: 'Saldo', key: 's', width: 13, style: { numFmt: money } },
      { header: 'Costo', key: 'co', width: 13, style: { numFmt: money } },
      { header: 'Utilidad', key: 'u', width: 13, style: { numFmt: money } },
      { header: 'Margen', key: 'm', width: 10, style: { numFmt: pct } },
    ];

    const STATUS_ES: Record<string, string> = { pending: 'Pendiente', processing: 'En proceso', completed: 'Completada', cancelled: 'Cancelada' };

    for (const o of orders) {
      const items = o.orderItems ?? [];
      const base = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
      const total = Number(o.totalAmount);
      const tax = Math.max(0, total - base);
      const cost = items.reduce((s, it) => s + Number(it.quantity) * (costMap.get(it.productId) ?? 0), 0);
      const cancelled = o.status === 'cancelled';
      const isCredit = o.paymentType === 'credit';
      const paid = isCredit ? (o.paidAt ? total : Math.min(total, paidMap.get(o.id) ?? 0)) : total;
      const balance = cancelled ? 0 : Math.max(0, total - paid);

      if (!cancelled) {
        tBase += base; tTax += tax; tTotal += total; tCost += cost;
        if (isCredit) { creditCount++; creditTotal += total; creditPaid += paid; creditBalance += balance; }
        else { cashCount++; cashTotal += total; }
        for (const it of items) {
          const pid = it.productId;
          const agg = prodAgg.get(pid) ?? {
            name: it.product?.name ?? `#${pid}`, code: it.product?.code ?? '',
            unit: it.product?.unit ?? '', stock: Number(it.product?.stock ?? 0),
            qty: 0, revenue: 0, cost: 0,
          };
          agg.qty += Number(it.quantity);
          agg.revenue += Number(it.quantity) * Number(it.unitPrice);
          agg.cost += Number(it.quantity) * (costMap.get(pid) ?? 0);
          prodAgg.set(pid, agg);
        }
        const cid = o.customerId;
        const ca = custAgg.get(cid) ?? { name: o.customer?.name ?? `#${cid}`, orders: 0, total: 0, base: 0, profit: 0, balance: 0 };
        ca.orders++; ca.total += total; ca.base += base; ca.profit += base - cost; ca.balance += balance;
        custAgg.set(cid, ca);
      } else {
        cancelledCount++;
      }

      const row = wsOrders.addRow({
        n: o.orderNumber,
        f: new Date(o.createdAt).toLocaleDateString('es-CO'),
        c: o.customer?.name ?? '',
        v: o.user?.username ?? '',
        e: STATUS_ES[o.status] ?? o.status,
        tp: isCredit ? (o.paidAt ? 'Crédito (pagada)' : 'Crédito (pendiente)') : 'Contado',
        b: cancelled ? 0 : Math.round(base),
        i: cancelled ? 0 : Math.round(tax),
        t: cancelled ? 0 : Math.round(total),
        a: cancelled ? 0 : Math.round(paid),
        s: Math.round(balance),
        co: cancelled ? 0 : Math.round(cost),
        u: cancelled ? 0 : Math.round(base - cost),
        m: !cancelled && base > 0 ? (base - cost) / base : 0,
      });
      if (cancelled) row.font = { color: { argb: 'FF9CA3AF' }, strike: true };
      if (!cancelled && balance > 0.01) row.getCell('s').font = { color: { argb: 'FFDC2626' }, bold: true };
    }
    // Fila de totales
    const totalRow = wsOrders.addRow({
      n: 'TOTALES', c: '(sin canceladas)',
      b: Math.round(tBase), i: Math.round(tTax), t: Math.round(tTotal),
      a: Math.round(cashTotal + creditPaid), s: Math.round(creditBalance),
      co: Math.round(tCost), u: Math.round(tBase - tCost),
      m: tBase > 0 ? (tBase - tCost) / tBase : 0,
    });
    totalRow.font = { bold: true };
    totalRow.border = { top: { style: 'double' } };
    styleHeader(wsOrders);

    // ── Hoja 3: Productos ──
    const wsProd = wb.addWorksheet('Productos');
    wsProd.columns = [
      { header: 'Código', key: 'c', width: 12 },
      { header: 'Producto', key: 'p', width: 34 },
      { header: 'Unidad', key: 'un', width: 10 },
      { header: 'Cantidad vendida', key: 'q', width: 16, style: { numFmt: '#,##0.##' } },
      { header: 'Ventas (base)', key: 'r', width: 15, style: { numFmt: money } },
      { header: 'Costo', key: 'co', width: 13, style: { numFmt: money } },
      { header: 'Utilidad', key: 'u', width: 13, style: { numFmt: money } },
      { header: 'Margen', key: 'm', width: 10, style: { numFmt: pct } },
      { header: '% de las ventas', key: 'sh', width: 14, style: { numFmt: pct } },
      { header: 'Stock actual', key: 'st', width: 12, style: { numFmt: '#,##0.##' } },
    ];
    for (const agg of [...prodAgg.values()].sort((a, b) => b.revenue - a.revenue)) {
      const row = wsProd.addRow({
        c: agg.code, p: agg.name, un: agg.unit, q: agg.qty,
        r: Math.round(agg.revenue), co: Math.round(agg.cost), u: Math.round(agg.revenue - agg.cost),
        m: agg.revenue > 0 ? (agg.revenue - agg.cost) / agg.revenue : 0,
        sh: tBase > 0 ? agg.revenue / tBase : 0,
        st: agg.stock,
      });
      if (agg.revenue - agg.cost < 0) row.getCell('u').font = { color: { argb: 'FFDC2626' }, bold: true };
    }
    styleHeader(wsProd);

    // ── Hoja 4: Clientes ──
    const wsCust = wb.addWorksheet('Clientes');
    wsCust.columns = [
      { header: 'Cliente', key: 'c', width: 32 },
      { header: 'Órdenes', key: 'o', width: 10 },
      { header: 'Total comprado', key: 't', width: 15, style: { numFmt: money } },
      { header: 'Utilidad generada', key: 'u', width: 16, style: { numFmt: money } },
      { header: 'Saldo pendiente', key: 's', width: 15, style: { numFmt: money } },
    ];
    for (const ca of [...custAgg.values()].sort((a, b) => b.total - a.total)) {
      const row = wsCust.addRow({ c: ca.name, o: ca.orders, t: Math.round(ca.total), u: Math.round(ca.profit), s: Math.round(ca.balance) });
      if (ca.balance > 0.01) row.getCell('s').font = { color: { argb: 'FFDC2626' }, bold: true };
    }
    styleHeader(wsCust);

    // ── Hoja 1: Resumen (con los acumulados) ──
    wsRes.columns = [{ width: 30 }, { width: 20 }];
    const monthName = start.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const title = wsRes.addRow([`Reporte de ventas — ${monthName}`]);
    title.font = { bold: true, size: 14 };
    wsRes.addRow([]);
    const activeOrders = orders.length - cancelledCount;
    const addKpi = (label: string, value: number | string, fmt?: string) => {
      const r = wsRes.addRow([label, value]);
      r.getCell(1).font = { color: { argb: 'FF6B7280' } };
      r.getCell(2).font = { bold: true };
      if (fmt) r.getCell(2).numFmt = fmt;
      return r;
    };
    addKpi('Órdenes del mes', activeOrders);
    addKpi('Órdenes canceladas', cancelledCount);
    addKpi('Ticket promedio', activeOrders > 0 ? Math.round(tTotal / activeOrders) : 0, money);
    wsRes.addRow([]);
    addKpi('Ventas base (sin IVA)', Math.round(tBase), money);
    addKpi('IVA facturado', Math.round(tTax), money);
    addKpi('Total facturado', Math.round(tTotal), money);
    wsRes.addRow([]);
    addKpi('Costo de lo vendido', Math.round(tCost), money);
    addKpi('Utilidad (sobre base)', Math.round(tBase - tCost), money);
    addKpi('Margen', tBase > 0 ? (tBase - tCost) / tBase : 0, pct);
    wsRes.addRow([]);
    addKpi('Ventas de contado', Math.round(cashTotal), money);
    addKpi('  órdenes de contado', cashCount);
    addKpi('Ventas a crédito', Math.round(creditTotal), money);
    addKpi('  órdenes a crédito', creditCount);
    addKpi('Cobrado (contado + abonos)', Math.round(cashTotal + creditPaid), money);
    addKpi('Por cobrar (saldo del mes)', Math.round(creditBalance), money);
    wsRes.addRow([]);
    const topProd = [...prodAgg.values()].sort((a, b) => b.revenue - a.revenue)[0];
    const topCust = [...custAgg.values()].sort((a, b) => b.total - a.total)[0];
    if (topProd) addKpi('Producto más vendido', `${topProd.name} ($${Math.round(topProd.revenue).toLocaleString('es-CO')})`);
    if (topCust) addKpi('Mejor cliente', `${topCust.name} ($${Math.round(topCust.total).toLocaleString('es-CO')})`);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { filename: `reporte-ventas-${month}.xlsx`, buffer };
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
  async updateOrder(id: number, updateData: UpdateOrderDto, tenantId: number, editorUserId?: number): Promise<OrderResponseDto> {
    const validatedData = validatePartialSchema(updateOrderSchema, updateData) as Partial<UpdateOrderDto>;

    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findOne({ where: { id, tenantId }, transaction });
      if (!order) {
        throw new NotFoundError('Order not found');
      }
      // Estado previo para reconciliar stock al final (cancelación o cambio de items)
      const prevStatus = order.status;
      const prevItems = await OrderItem.findAll({ where: { orderId: id }, transaction, raw: true });

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
                  totalPrice: Math.round(item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100) * 100) / 100,
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
                  totalPrice: Math.round(item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100) * 100) / 100,
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

      // Si es a crédito y cambió el total, recalcular paidAt contra los abonos:
      // sin esto, agrandar una orden ya pagada dejaba la deuda nueva invisible
      // para cartera y recordatorios (filtran por paidAt null)
      if (order.paymentType === 'credit' && validatedData.items) {
        const { OrderPayment } = await import('./order-payment.model');
        const paid = Number(await OrderPayment.sum('amount', { where: { orderId: id }, transaction })) || 0;
        const fullyPaid = paid >= Number(order.totalAmount) - 0.01;
        if (fullyPaid && !order.paidAt) await order.update({ paidAt: new Date() }, { transaction });
        if (!fullyPaid && order.paidAt) await order.update({ paidAt: null }, { transaction });
      }

      // ── Reconciliar stock ──
      // Impacto en stock de una orden activa = -cantidad por producto; una orden
      // cancelada no descuenta. Se compara el impacto antes vs. después y la
      // diferencia se registra como ajuste (devuelve o descuenta lo justo).
      const currentItems = validatedData.items
        ? await OrderItem.findAll({ where: { orderId: id }, transaction, raw: true })
        : prevItems;
      const sumByProduct = (items: Array<{ productId: number; quantity: number }>) => {
        const m = new Map<number, number>();
        for (const it of items) m.set(it.productId, (m.get(it.productId) ?? 0) + Number(it.quantity));
        return m;
      };
      const before = prevStatus !== 'cancelled' ? sumByProduct(prevItems) : new Map<number, number>();
      const after = order.status !== 'cancelled' ? sumByProduct(currentItems) : new Map<number, number>();
      const productIds = new Set([...before.keys(), ...after.keys()]);
      for (const productId of productIds) {
        const delta = (before.get(productId) ?? 0) - (after.get(productId) ?? 0); // >0 devuelve stock
        if (delta !== 0) {
          await this.stockMovementService.createMovement({
            tenantId,
            productId,
            type: 'adjustment',
            quantity: delta,
            referenceId: id,
            referenceType: 'order',
            userId: editorUserId ?? order.userId,
            notes: order.status === 'cancelled' && prevStatus !== 'cancelled'
              ? `Orden ${order.orderNumber} cancelada — stock devuelto`
              : prevStatus === 'cancelled' && order.status !== 'cancelled'
                ? `Orden ${order.orderNumber} reactivada — stock descontado`
                : `Edición de orden ${order.orderNumber}`,
            transaction,
          });
        }
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
    const t = await sequelize.transaction();
    try {
      // Devolver el stock que la orden había descontado (si estaba activa)
      if (order.status !== 'cancelled') {
        const items = await OrderItem.findAll({ where: { orderId: id }, transaction: t, raw: true });
        for (const item of items) {
          await this.stockMovementService.createMovement({
            tenantId,
            productId: item.productId,
            type: 'adjustment',
            quantity: Number(item.quantity),
            referenceId: id,
            referenceType: 'order',
            userId: order.userId,
            notes: `Orden ${order.orderNumber} eliminada — stock devuelto`,
            transaction: t,
          });
        }
      }
      await order.destroy({ transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
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
    const t = await sequelize.transaction();
    try {
      await order.restore({ transaction: t });
      // La eliminación devolvió el stock; al restaurar se descuenta de nuevo
      if (order.status !== 'cancelled') {
        const items = await OrderItem.findAll({ where: { orderId: id }, transaction: t, raw: true });
        for (const item of items) {
          await this.stockMovementService.createMovement({
            tenantId,
            productId: item.productId,
            type: 'adjustment',
            quantity: -Number(item.quantity),
            referenceId: id,
            referenceType: 'order',
            userId: order.userId,
            notes: `Orden ${order.orderNumber} restaurada — stock descontado`,
            transaction: t,
          });
        }
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
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