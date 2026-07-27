import { Tenant, TenantPlan, TenantAttributes } from './tenant.model';
import { User } from '../user/user.model';
import { Category } from '../category/category.model';
import { Product } from '../product/product.model';
import { Order } from '../order/order.model';
import { OrderItem } from '../order/order-item.model';
import { Supplier } from '../supplier/supplier.model';
import { Price } from '../price/price.model';
import { Customer } from '../customer/customer.model';
import { PurchaseOrder } from '../purchase-order/purchase-order.model';
import { PurchaseOrderItem } from '../purchase-order/purchase-order-item/purchase-order-item.model';
import { StockMovement } from '../stock-movement/stock-movement.model';
import { AuthService } from '../auth/auth.service';
import { pushService } from '../push/push.service';
import { getJobStatuses } from '@/core/jobs/jobStatus';
import { APP_VERSION } from '@/config/version';
import { ConflictError, NotFoundError } from '@/core/errors/AppError';
import sequelize from '@/database';
import { Op, fn, col } from 'sequelize';
import bcrypt from 'bcryptjs';

const PLAN_LIMITS: Record<TenantPlan, { maxUsers: number; maxProducts: number; maxOrdersPerMonth: number }> = {
  trial:      { maxUsers: 3,  maxProducts: 100,   maxOrdersPerMonth: 50   },
  basic:      { maxUsers: 3,  maxProducts: 500,   maxOrdersPerMonth: 200  },
  pro:        { maxUsers: 10, maxProducts: 5000,  maxOrdersPerMonth: 1000 },
  enterprise: { maxUsers: 999, maxProducts: 99999, maxOrdersPerMonth: 99999 },
};

export class TenantService {
  async create(data: {
    slug: string;
    name: string;
    plan?: TenantPlan;
    adminUsername: string;
    adminPassword: string;
    primaryColor?: string;
  }) {
    const RESERVED_SLUGS = ['admin', 'api', 'www', 'app', 'platform', 'registro'];
    if (RESERVED_SLUGS.includes(data.slug)) throw new ConflictError(`Slug "${data.slug}" está reservado`);
    const existing = await Tenant.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictError(`Slug "${data.slug}" ya está en uso`);

    const plan: TenantPlan = data.plan ?? 'trial';
    const limits = PLAN_LIMITS[plan];
    const trialEndsAt = plan === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

    return sequelize.transaction(async (t: any) => {
      const tenant = await Tenant.create({
        slug: data.slug,
        name: data.name,
        plan,
        status: plan === 'trial' ? 'trial' : 'active',
        logoUrl: null,
        primaryColor: data.primaryColor ?? '#2563eb',
        trialEndsAt,
        ...limits,
      }, { transaction: t });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.adminPassword, salt);

      await User.create({
        tenantId: tenant.id,
        username: data.adminUsername,
        password: hashedPassword,
        role: 'admin',
      } as any, { transaction: t, hooks: false });

      await Category.create(
        { tenantId: tenant.id, name: 'Sin categoría' },
        { transaction: t }
      );

      return tenant;
    });
  }

  async findBySlug(slug: string) {
    const tenant = await Tenant.findOne({ where: { slug } });
    if (!tenant) throw new NotFoundError(`Tenant "${slug}" no encontrado`);
    return tenant;
  }

  async findById(id: number) {
    const tenant = await Tenant.findByPk(id);
    if (!tenant) throw new NotFoundError('Tenant no encontrado');
    return tenant;
  }

  // Versión pública de getInfo — solo lo necesario para theming del login.
  // No expone plan, trial ni límites (GET /tenants/slug/:slug es público)
  async getPublicInfo(tenantId: number) {
    const tenant = await this.findById(tenantId);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
    };
  }

  async getInfo(tenantId: number) {
    const tenant = await this.findById(tenantId);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
      trialEndsAt: tenant.trialEndsAt,
      maxUsers: tenant.maxUsers,
      maxProducts: tenant.maxProducts,
      maxOrdersPerMonth: tenant.maxOrdersPerMonth,
    };
  }

  async updateTheme(tenantId: number, data: { primaryColor?: string; logoUrl?: string | null; name?: string }) {
    const tenant = await this.findById(tenantId);
    await tenant.update(data);
    return tenant;
  }

  async suspend(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'suspended' });
    return tenant;
  }

  async activate(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'active' });
    return tenant;
  }

  async update(tenantId: number, data: {
    name?: string | undefined;
    plan?: TenantPlan | undefined;
    trialEndsAt?: string | null | undefined;
    maxUsers?: number | undefined;
    maxProducts?: number | undefined;
    maxOrdersPerMonth?: number | undefined;
  }) {
    const tenant = await this.findById(tenantId);
    const updates: Partial<TenantAttributes> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.trialEndsAt !== undefined) {
      updates.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
      // Extender un trial vencido reactiva el tenant suspendido automáticamente
      if (
        tenant.status === 'suspended' &&
        (data.plan ?? tenant.plan) === 'trial' &&
        updates.trialEndsAt &&
        updates.trialEndsAt > new Date()
      ) {
        updates.status = 'trial';
      }
    }
    if (data.maxUsers !== undefined) updates.maxUsers = data.maxUsers;
    if (data.maxProducts !== undefined) updates.maxProducts = data.maxProducts;
    if (data.maxOrdersPerMonth !== undefined) updates.maxOrdersPerMonth = data.maxOrdersPerMonth;

    if (data.plan !== undefined && data.plan !== tenant.plan) {
      const limits = PLAN_LIMITS[data.plan];
      updates.plan = data.plan;
      updates.maxUsers = data.maxUsers ?? limits.maxUsers;
      updates.maxProducts = data.maxProducts ?? limits.maxProducts;
      updates.maxOrdersPerMonth = data.maxOrdersPerMonth ?? limits.maxOrdersPerMonth;
      if (data.plan !== 'trial') updates.trialEndsAt = null;
      if (tenant.status === 'trial' && data.plan !== 'trial') updates.status = 'active';
    }

    await tenant.update(updates);
    return tenant;
  }

  // ── Pagos de planes (Bre-B manual con aprobación) ───────────────────────
  async getBilling(tenantId: number) {
    const { PlanPayment } = await import('./plan-payment.model');
    const { getPlanConfig } = await import('@/config/plans');
    const cfg = await getPlanConfig();
    const tenant = await this.findById(tenantId);
    const payments = await PlanPayment.findAll({
      where: { tenantId },
      attributes: { exclude: ['receiptBase64'] },
      order: [['createdAt', 'DESC']],
      limit: 24,
    });
    return {
      brebKey: cfg.brebKey,
      brebHolder: cfg.brebHolder,
      prices: cfg.prices,
      currentPlan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      payments,
    };
  }

  async reportPayment(tenantId: number, data: { plan: string; amount: number; reference?: string; receiptBase64?: string; receiptMime?: string }) {
    const { PlanPayment } = await import('./plan-payment.model');
    const { getPlanConfig } = await import('@/config/plans');
    const cfg = await getPlanConfig();
    if (!cfg.prices[data.plan]) throw new ConflictError('Plan inválido');
    if (data.receiptBase64 && data.receiptBase64.length > 2_800_000) {
      throw new ConflictError('El comprobante supera 2MB — usa una imagen más liviana');
    }
    const tenant = await this.findById(tenantId);
    const payment = await PlanPayment.create({
      tenantId,
      plan: data.plan,
      amount: data.amount,
      reference: data.reference ?? null,
      receiptBase64: data.receiptBase64 ?? null,
      receiptMime: data.receiptMime ?? null,
      status: 'pending',
      receiptNumber: null,
      rejectReason: null,
      decidedAt: null,
    });

    const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
    await pushService.notifyUsers(
      superadmins.map(u => u.id),
      'Pago reportado 💰',
      `${tenant.name} reportó pago del plan ${data.plan}: $${Number(data.amount).toLocaleString('es-CO')}${data.reference ? ` (ref ${data.reference})` : ''}. Revisa el comprobante y aprueba.`,
      { url: '/superadmin' },
    );
    return { id: payment.id, status: payment.status };
  }

  async listPayments() {
    const { PlanPayment } = await import('./plan-payment.model');
    const payments = await PlanPayment.findAll({
      attributes: { exclude: ['receiptBase64'] },
      order: [['createdAt', 'DESC']],
      limit: 100,
      raw: true,
    });
    const tenantIds = [...new Set(payments.map(p => p.tenantId))];
    const tenants = await Tenant.findAll({ where: { id: tenantIds }, attributes: ['id', 'name', 'slug'], raw: true });
    const tmap = new Map(tenants.map(t => [t.id, t]));
    return payments.map(p => ({ ...p, tenant: tmap.get(p.tenantId) ?? null }));
  }

  async getPaymentReceipt(paymentId: number) {
    const { PlanPayment } = await import('./plan-payment.model');
    const payment = await PlanPayment.findByPk(paymentId);
    if (!payment) throw new NotFoundError('Pago no encontrado');
    return { receiptBase64: payment.receiptBase64, receiptMime: payment.receiptMime };
  }

  async decidePayment(paymentId: number, approve: boolean, reason?: string) {
    const { PlanPayment } = await import('./plan-payment.model');
    const payment = await PlanPayment.findByPk(paymentId);
    if (!payment) throw new NotFoundError('Pago no encontrado');
    if (payment.status !== 'pending') throw new ConflictError('El pago ya fue procesado');

    const tenant = await this.findById(payment.tenantId);
    const admins = await User.findAll({ where: { tenantId: tenant.id, role: 'admin' }, attributes: ['id'] });

    if (approve) {
      const approvedCount = await PlanPayment.count({ where: { status: 'approved' } });
      const receiptNumber = `REC-${String(approvedCount + 1).padStart(4, '0')}`;
      await payment.update({ status: 'approved', receiptNumber, decidedAt: new Date() });
      // Activar el plan pagado
      await tenant.update({ plan: payment.plan as TenantPlan, status: 'active', trialEndsAt: null });
      await pushService.notifyUsers(
        admins.map(u => u.id),
        'Pago confirmado ✓',
        `Tu pago del plan ${payment.plan} fue confirmado. Recibo ${receiptNumber}. ¡Gracias!`,
        { url: '/settings' },
      );
    } else {
      await payment.update({ status: 'rejected', rejectReason: reason ?? null, decidedAt: new Date() });
      await pushService.notifyUsers(
        admins.map(u => u.id),
        'Pago no confirmado',
        `No pudimos confirmar tu pago${reason ? `: ${reason}` : ''}. Repórtalo de nuevo o contáctanos.`,
        { url: '/settings' },
      );
    }
    return payment;
  }

  async getPlatformSettings() {
    const { getPlanConfig } = await import('@/config/plans');
    return getPlanConfig();
  }

  async updatePlatformSettings(data: { brebKey?: string; brebHolder?: string; prices?: Record<string, number> }) {
    const { setPlanConfig } = await import('@/config/plans');
    return setPlanConfig(data);
  }

  // ── Solicitudes de registro ──────────────────────────────────────────────
  async listRequests() {
    const { TenantRequest } = await import('./tenant-request.model');
    return TenantRequest.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
  }

  async approveRequest(requestId: number, data: { slug: string; adminUsername: string; adminPassword: string; plan?: TenantPlan; primaryColor?: string }) {
    const { TenantRequest } = await import('./tenant-request.model');
    const request = await TenantRequest.findByPk(requestId);
    if (!request) throw new NotFoundError('Solicitud no encontrada');
    if (request.status !== 'pending') throw new ConflictError('La solicitud ya fue procesada');

    const tenant = await this.create({
      slug: data.slug,
      name: request.companyName,
      adminUsername: data.adminUsername,
      adminPassword: data.adminPassword,
      ...(data.plan !== undefined && { plan: data.plan }),
      ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
    });

    await request.update({ status: 'approved', tenantId: tenant.id });
    return { request, tenant };
  }

  async rejectRequest(requestId: number) {
    const { TenantRequest } = await import('./tenant-request.model');
    const request = await TenantRequest.findByPk(requestId);
    if (!request) throw new NotFoundError('Solicitud no encontrada');
    await request.update({ status: 'rejected' });
    return request;
  }

  // Impersonar: token de sesión del primer admin del tenant (soporte superadmin)
  async impersonate(tenantId: number) {
    const tenant = await this.findById(tenantId);
    const admin = await User.findOne({
      where: { tenantId, role: 'admin' },
      order: [['createdAt', 'ASC']],
    });
    if (!admin) throw new NotFoundError('El tenant no tiene usuario admin');
    const token = new AuthService().generateToken(admin.id, admin.username, admin.role, admin.tenantId);
    return { token, slug: tenant.slug, username: admin.username };
  }

  // Detalle operativo del tenant para el panel superadmin
  async getDetail(tenantId: number) {
    const tenant = await this.findById(tenantId);

    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [users, ordersByMonth, receivable] = await Promise.all([
      User.findAll({
        where: { tenantId },
        attributes: ['id', 'username', 'role', 'createdAt'],
        order: [['createdAt', 'ASC']],
      }),
      Order.findAll({
        where: { tenantId, createdAt: { [Op.gte]: since } },
        attributes: [
          [fn('DATE_FORMAT', col('createdAt'), '%Y-%m'), 'month'],
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('totalAmount')), 'total'],
        ],
        group: ['month'],
        order: [[col('month'), 'ASC']],
        raw: true,
      }) as unknown as Promise<Array<{ month: string; count: number; total: string }>>,
      Order.sum('totalAmount', {
        where: { tenantId, paymentType: 'credit', paidAt: null, status: { [Op.ne]: 'cancelled' } },
      }),
    ]);

    return {
      tenant: this.getInfoFromInstance(tenant),
      users,
      ordersByMonth: ordersByMonth.map(r => ({ month: r.month, count: Number(r.count), total: Number(r.total) })),
      receivable: Number(receivable) || 0,
    };
  }

  // Anuncio push: a un tenant específico o a toda la plataforma
  async broadcast(data: { tenantId?: number; onlyAdmins?: boolean; title: string; body: string }) {
    const where: Record<string, unknown> = {};
    if (data.tenantId) where['tenantId'] = data.tenantId;
    where['role'] = data.onlyAdmins ? 'admin' : { [Op.ne]: 'superadmin' };

    const users = await User.findAll({ where: where as never, attributes: ['id'] });
    await pushService.notifyUsers(users.map(u => u.id), data.title, data.body, { url: '/' });
    return { recipients: users.length };
  }

  // Crecimiento de la plataforma + salud del sistema
  async getPlatformStats() {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [tenantsByMonth, ordersByMonth] = await Promise.all([
      Tenant.findAll({
        where: { createdAt: { [Op.gte]: since }, slug: { [Op.notIn]: ['platform'] } },
        attributes: [[fn('DATE_FORMAT', col('createdAt'), '%Y-%m'), 'month'], [fn('COUNT', col('id')), 'count']],
        group: ['month'],
        order: [[col('month'), 'ASC']],
        raw: true,
      }) as unknown as Promise<Array<{ month: string; count: number }>>,
      Order.findAll({
        where: { createdAt: { [Op.gte]: since } },
        attributes: [
          [fn('DATE_FORMAT', col('createdAt'), '%Y-%m'), 'month'],
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('totalAmount')), 'total'],
        ],
        group: ['month'],
        order: [[col('month'), 'ASC']],
        raw: true,
      }) as unknown as Promise<Array<{ month: string; count: number; total: string }>>,
    ]);

    return {
      version: APP_VERSION,
      jobs: getJobStatuses(),
      tenantsByMonth: tenantsByMonth.map(r => ({ month: r.month, count: Number(r.count) })),
      ordersByMonth: ordersByMonth.map(r => ({ month: r.month, count: Number(r.count), total: Number(r.total) })),
    };
  }

  // Export completo de los datos de un tenant (offboarding / respaldo puntual)
  async exportTenantData(tenantId: number) {
    const tenant = await this.findById(tenantId);
    const w = { tenantId };

    const [users, categories, products, suppliers, prices, customers, orders, purchaseOrders, stockMovements] =
      await Promise.all([
        User.findAll({ where: w, attributes: { exclude: ['password'] }, raw: true }),
        Category.findAll({ where: w, raw: true }),
        Product.findAll({ where: w, raw: true }),
        Supplier.findAll({ where: w, raw: true }),
        Price.findAll({ where: w, raw: true }),
        Customer.findAll({ where: w, raw: true }),
        Order.findAll({ where: w, include: [{ model: OrderItem, as: 'orderItems' }] }),
        PurchaseOrder.findAll({ where: w, include: [{ model: PurchaseOrderItem, as: 'items' }] }),
        StockMovement.findAll({ where: w, raw: true }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      tenant: this.getInfoFromInstance(tenant),
      data: {
        users,
        categories,
        products,
        suppliers,
        prices,
        customers,
        orders: orders.map(o => o.toJSON()),
        purchaseOrders: purchaseOrders.map(p => p.toJSON()),
        stockMovements,
      },
    };
  }

  private getInfoFromInstance(tenant: Tenant) {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
      trialEndsAt: tenant.trialEndsAt,
      maxUsers: tenant.maxUsers,
      maxProducts: tenant.maxProducts,
      maxOrdersPerMonth: tenant.maxOrdersPerMonth,
      createdAt: tenant.createdAt,
    };
  }

  async listAll() {
    const tenants = await Tenant.findAll({ order: [['createdAt', 'DESC']] });

    // Stats de uso por tenant en 3 queries agrupadas (sin N+1)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [userCounts, productCounts, orderCounts] = await Promise.all([
      User.count({ group: ['tenantId'] }),
      Product.count({ group: ['tenantId'] }),
      Order.count({ where: { createdAt: { [Op.gte]: startOfMonth } }, group: ['tenantId'] }),
    ]);

    const toMap = (rows: object[]): Record<number, number> =>
      Object.fromEntries(
        (rows as Array<{ tenantId: number; count: number }>).map((r) => [r.tenantId, r.count])
      );
    const users = toMap(userCounts);
    const products = toMap(productCounts);
    const orders = toMap(orderCounts);

    return tenants.map((t) => ({
      ...(t.toJSON() as TenantAttributes),
      usage: {
        users: users[t.id] ?? 0,
        products: products[t.id] ?? 0,
        ordersThisMonth: orders[t.id] ?? 0,
      },
    }));
  }

  getPlanLimits(plan: TenantPlan) {
    return PLAN_LIMITS[plan];
  }
}
