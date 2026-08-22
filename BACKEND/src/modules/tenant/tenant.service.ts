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
import { ConflictError, NotFoundError, BadRequestError } from '@/core/errors/AppError';
import { computePaymentPeriod, toDateOnly } from './subscription';
import { sendEmail, renderEmail } from '@/core/email';
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
    }).then(async (tenant: Tenant) => {
      // Crear el subdominio en Dokploy automáticamente (antes era manual).
      // Fire-and-forget: si falla, push al superadmin para hacerlo a mano.
      import('@/core/dokploy').then(async ({ dokployEnabled, registerTenantDomain }) => {
        if (!dokployEnabled || ['demo', 'platform'].includes(tenant.slug)) return;
        const r = await registerTenantDomain(tenant.slug);
        const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
        await pushService.notifyUsers(
          superadmins.map(u => u.id),
          r.ok ? 'Dominio del tenant creado' : '⚠ Dominio del tenant NO creado',
          r.detail,
          { url: '/' },
        );
      }).catch(() => {});
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
    const { resolveFeatures } = await import('@/config/features');
    const { getPlanConfig } = await import('@/config/plans');
    const cfg = await getPlanConfig();
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor ?? '#2563eb',
      trialEndsAt: tenant.trialEndsAt,
      paidUntil: tenant.paidUntil,
      maxUsers: tenant.maxUsers,
      maxProducts: tenant.maxProducts,
      maxOrdersPerMonth: tenant.maxOrdersPerMonth,
      features: [...resolveFeatures(tenant, cfg.planFeatures)],
    };
  }

  async updateTheme(tenantId: number, data: { primaryColor?: string; logoUrl?: string | null; name?: string }) {
    const tenant = await this.findById(tenantId);
    await tenant.update(data);
    return tenant;
  }

  async suspend(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'suspended', suspendedReason: 'manual' });
    return tenant;
  }

  async activate(tenantId: number) {
    const tenant = await this.findById(tenantId);
    await tenant.update({ status: 'active', suspendedReason: null, cancelledAt: null });
    return tenant;
  }

  // Offboarding: marca el tenant como cancelado (los datos se conservan 90 días)
  async cancelTenant(tenantId: number) {
    const tenant = await this.findById(tenantId);
    if (tenant.slug === 'demo') throw new ConflictError('El tenant demo no se puede cancelar');
    await tenant.update({ status: 'cancelled', cancelledAt: new Date(), suspendedReason: null, paidUntil: null });
    return tenant;
  }

  /**
   * Purga los datos de negocio de un tenant CANCELADO (irreversible).
   * Conserva: la fila del tenant (histórico) y sus plan_payments (contabilidad).
   * Borra: usuarios, productos, precios, clientes, órdenes/items/abonos,
   * proveedores, compras, movimientos, categorías y suscripciones push.
   */
  async purgeTenant(tenantId: number) {
    const tenant = await this.findById(tenantId);
    if (tenant.status !== 'cancelled') throw new ConflictError('Solo se pueden purgar tenants cancelados');
    const { OrderPayment } = await import('../order/order-payment.model');
    const { PushSubscription } = await import('../push/push-subscription.model');

    return sequelize.transaction(async (t: any) => {
      const orders = await Order.findAll({ where: { tenantId }, attributes: ['id'], paranoid: false, transaction: t, raw: true });
      const orderIds = orders.map(o => o.id);
      const pos = await PurchaseOrder.findAll({ where: { tenantId }, attributes: ['id'], paranoid: false, transaction: t, raw: true });
      const poIds = pos.map(o => o.id);
      const users = await User.findAll({ where: { tenantId }, attributes: ['id'], paranoid: false, transaction: t, raw: true });
      const userIds = users.map(u => u.id);

      if (orderIds.length) {
        await OrderPayment.destroy({ where: { orderId: orderIds }, force: true, transaction: t });
        await OrderItem.destroy({ where: { orderId: orderIds }, force: true, transaction: t });
      }
      await Order.destroy({ where: { tenantId }, force: true, transaction: t });
      if (poIds.length) await PurchaseOrderItem.destroy({ where: { purchaseOrderId: poIds }, force: true, transaction: t });
      await PurchaseOrder.destroy({ where: { tenantId }, force: true, transaction: t });
      await StockMovement.destroy({ where: { tenantId }, force: true, transaction: t });
      await Price.destroy({ where: { tenantId }, force: true, transaction: t });
      await Product.destroy({ where: { tenantId }, force: true, transaction: t });
      await Customer.destroy({ where: { tenantId }, force: true, transaction: t });
      await Supplier.destroy({ where: { tenantId }, force: true, transaction: t });
      await Category.destroy({ where: { tenantId }, force: true, transaction: t });
      if (userIds.length) await PushSubscription.destroy({ where: { userId: userIds }, force: true, transaction: t });
      await User.destroy({ where: { tenantId }, force: true, transaction: t });

      return { purged: true, tenantId, slug: tenant.slug };
    });
  }

  /**
   * Aplica un pago de N meses al ciclo del tenant: fija paidUntil, activa el
   * plan, y reactiva suspensiones por trial/no-pago (NO las manuales).
   * Usado por el registro manual del superadmin y por la aprobación de pagos
   * reportados — mismo camino de código para ambos flujos.
   */
  private async applyPaymentToTenant(tenant: Tenant, plan: TenantPlan, months: number) {
    const { periodStart, periodEnd } = computePaymentPeriod(tenant.paidUntil, months);
    const updates: Partial<TenantAttributes> = { paidUntil: toDateOnly(periodEnd), plan };

    if (tenant.status === 'trial') {
      updates.status = 'active';
      updates.trialEndsAt = null;
    }
    if (tenant.status === 'suspended' && ['nonpayment', 'trial_expired'].includes(tenant.suspendedReason ?? '')) {
      updates.status = 'active';
      updates.suspendedReason = null;
    }
    if (tenant.plan !== plan) {
      const limits = PLAN_LIMITS[plan];
      updates.maxUsers = limits.maxUsers;
      updates.maxProducts = limits.maxProducts;
      updates.maxOrdersPerMonth = limits.maxOrdersPerMonth;
    }
    await tenant.update(updates);
    return { periodStart, periodEnd };
  }

  // Registro manual de pago por el superadmin (ej. transferencia recibida por fuera)
  async registerManualPayment(tenantId: number, data: {
    plan?: TenantPlan; amount: number; months?: number;
    method?: string; paidAt?: string; reference?: string; notes?: string;
  }) {
    const { PlanPayment } = await import('./plan-payment.model');
    const tenant = await this.findById(tenantId);

    const months = Math.min(24, Math.max(1, Math.trunc(Number(data.months ?? 1))));
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestError('Monto inválido');
    const plan: TenantPlan = data.plan ?? (tenant.plan === 'trial' ? 'basic' : tenant.plan);
    if (!['basic', 'pro', 'enterprise'].includes(plan)) throw new BadRequestError('Plan inválido');
    const paidAt = data.paidAt && /^\d{4}-\d{2}-\d{2}$/.test(data.paidAt) ? data.paidAt : toDateOnly(new Date());

    const payment = await sequelize.transaction(async (t: any) => {
      const approvedCount = await PlanPayment.count({ where: { status: 'approved' }, transaction: t });
      const receiptNumber = `REC-${String(approvedCount + 1).padStart(4, '0')}`;
      const { periodStart, periodEnd } = await this.applyPaymentToTenant(tenant, plan, months);
      return PlanPayment.create({
        tenantId: tenant.id,
        plan,
        amount,
        reference: data.reference?.slice(0, 120) ?? null,
        receiptBase64: null,
        receiptMime: null,
        status: 'approved',
        receiptNumber,
        rejectReason: null,
        decidedAt: new Date(),
        source: 'superadmin',
        method: data.method?.slice(0, 20) ?? 'transferencia',
        months,
        paidAt,
        periodStart: toDateOnly(periodStart),
        periodEnd: toDateOnly(periodEnd),
        notes: data.notes?.slice(0, 255) ?? null,
      }, { transaction: t });
    });

    const admins = await User.findAll({ where: { tenantId: tenant.id, role: 'admin' }, attributes: ['id'] });
    pushService.notifyUsers(
      admins.map(u => u.id),
      'Pago recibido ✓',
      `Registramos tu pago del plan ${plan}. Recibo ${payment.receiptNumber}. Activo hasta ${payment.periodEnd}. ¡Gracias!`,
      { url: '/settings' },
    ).catch(() => {});
    import('./receipt.routes').then(({ receiptUrl: rUrl }) =>
      sendEmail(tenant.contactEmail, `Recibo ${payment.receiptNumber} — Merco`, renderEmail('Pago recibido ✓', [
        `Registramos tu pago de <b>$${amount.toLocaleString('es-CO')}</b> del plan <b>${plan}</b> de <b>${tenant.name}</b>.`,
        `Recibo: <b>${payment.receiptNumber}</b> · Fecha: ${paidAt} · Cubre hasta: <b>${payment.periodEnd}</b>.`,
        '¡Gracias por tu pago!',
      ], { label: 'Ver recibo', url: rUrl(payment.id) }))
    ).catch(() => {});

    return payment;
  }

  async update(tenantId: number, data: {
    name?: string | undefined;
    plan?: TenantPlan | undefined;
    trialEndsAt?: string | null | undefined;
    maxUsers?: number | undefined;
    maxProducts?: number | undefined;
    maxOrdersPerMonth?: number | undefined;
    customPrice?: number | null | undefined;
    customFeatures?: string[] | null | undefined; // null = usar default del plan
    contactName?: string | null | undefined;
    contactEmail?: string | null | undefined;
    contactPhone?: string | null | undefined;
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
    if (data.customPrice !== undefined) updates.customPrice = data.customPrice;
    if (data.customFeatures !== undefined) {
      const { isFeatureKey } = await import('@/config/features');
      updates.customFeatures = data.customFeatures ? JSON.stringify(data.customFeatures.filter(isFeatureKey)) : null;
    }
    if (data.contactName !== undefined) updates.contactName = data.contactName;
    if (data.contactEmail !== undefined) updates.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;

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
    const { receiptUrl } = await import('./receipt.routes');
    const rows = await PlanPayment.findAll({
      where: { tenantId },
      attributes: { exclude: ['receiptBase64'] },
      order: [['createdAt', 'DESC']],
      limit: 24,
      raw: true,
    });
    const payments = rows.map(p => ({
      ...p,
      receiptUrl: p.status === 'approved' ? receiptUrl(p.id) : null,
    }));
    return {
      brebKey: cfg.brebKey,
      brebHolder: cfg.brebHolder,
      prices: cfg.prices,
      currentPlan: tenant.plan,
      customPrice: tenant.customPrice != null ? Number(tenant.customPrice) : null,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      paidUntil: tenant.paidUntil,
      payments,
    };
  }

  async reportPayment(tenantId: number, data: { plan: string; amount: number; months?: number; reference?: string; receiptBase64?: string; receiptMime?: string }) {
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
      source: 'tenant',
      method: 'breb',
      months: Math.min(12, Math.max(1, Math.trunc(Number(data.months ?? 1)))),
      paidAt: null,
      periodStart: null,
      periodEnd: null,
      notes: null,
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
    const { receiptUrl } = await import('./receipt.routes');
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
    return payments.map(p => ({
      ...p,
      tenant: tmap.get(p.tenantId) ?? null,
      receiptUrl: p.status === 'approved' ? receiptUrl(p.id) : null,
    }));
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
      // Aprobar extiende el ciclo igual que un registro manual
      const { periodStart, periodEnd } = await this.applyPaymentToTenant(
        tenant, payment.plan as TenantPlan, payment.months ?? 1,
      );
      await payment.update({
        status: 'approved', receiptNumber, decidedAt: new Date(),
        periodStart: toDateOnly(periodStart), periodEnd: toDateOnly(periodEnd),
      });
      await pushService.notifyUsers(
        admins.map(u => u.id),
        'Pago confirmado ✓',
        `Tu pago del plan ${payment.plan} fue confirmado. Recibo ${receiptNumber}. Activo hasta ${toDateOnly(periodEnd)}. ¡Gracias!`,
        { url: '/settings' },
      );
      import('./receipt.routes').then(({ receiptUrl: rUrl }) =>
        sendEmail(tenant.contactEmail, `Recibo ${receiptNumber} — Merco`, renderEmail('Pago confirmado ✓', [
          `Confirmamos tu pago de <b>$${Number(payment.amount).toLocaleString('es-CO')}</b> del plan <b>${payment.plan}</b> de <b>${tenant.name}</b>.`,
          `Recibo: <b>${receiptNumber}</b> · Cubre hasta: <b>${toDateOnly(periodEnd)}</b>.`,
          '¡Gracias por tu pago!',
        ], { label: 'Ver recibo', url: rUrl(payment.id) }))
      ).catch(() => {});
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

  async updatePlatformSettings(data: {
    brebKey?: string; brebHolder?: string; prices?: Record<string, number>;
    renewalWarnDays?: number; graceDays?: number;
    planFeatures?: Partial<Record<TenantPlan, string[]>>;
  }) {
    const { setPlanConfig } = await import('@/config/plans');
    const { isFeatureKey } = await import('@/config/features');
    const planFeatures = data.planFeatures
      ? Object.fromEntries(
          Object.entries(data.planFeatures).map(([plan, list]) => [plan, (list ?? []).filter(isFeatureKey)]),
        )
      : undefined;
    return setPlanConfig({ ...data, planFeatures } as Parameters<typeof setPlanConfig>[0]);
  }

  // Dashboard financiero del superadmin: MRR, cobrado, vencimientos, morosos, LTV
  async getFinance() {
    const { PlanPayment } = await import('./plan-payment.model');
    const { getPlanConfig } = await import('@/config/plans');
    const cfg = await getPlanConfig();

    const today = toDateOnly(new Date());
    const plus30 = toDateOnly(new Date(Date.now() + 30 * 86400_000));

    const tenants = await Tenant.findAll({ where: { slug: { [Op.ne]: 'demo' } } });
    const priceOf = (t: Tenant) => Number(t.customPrice ?? cfg.prices[t.plan] ?? 0);
    const activePaying = tenants.filter(t => t.status === 'active' && t.plan !== 'trial');
    const mrr = activePaying.reduce((s, t) => s + priceOf(t), 0);

    const daysBetween = (a: string, b: string) =>
      Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400_000);

    const upcoming = activePaying
      .filter(t => t.paidUntil && t.paidUntil >= today && t.paidUntil <= plus30)
      .map(t => ({ id: t.id, name: t.name, slug: t.slug, plan: t.plan, paidUntil: t.paidUntil, amount: priceOf(t), daysLeft: daysBetween(today, t.paidUntil!) }))
      .sort((a, b) => a.paidUntil!.localeCompare(b.paidUntil!));

    const overdue = tenants
      .filter(t =>
        (t.status === 'active' && t.plan !== 'trial' && t.paidUntil && t.paidUntil < today) ||
        (t.status === 'suspended' && t.suspendedReason === 'nonpayment'))
      .map(t => ({
        id: t.id, name: t.name, slug: t.slug, plan: t.plan, paidUntil: t.paidUntil,
        amount: priceOf(t), daysOverdue: t.paidUntil ? daysBetween(t.paidUntil, today) : null,
        suspended: t.status === 'suspended',
      }))
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));

    const noPaidUntil = activePaying
      .filter(t => !t.paidUntil)
      .map(t => ({ id: t.id, name: t.name, slug: t.slug, plan: t.plan, amount: priceOf(t) }));

    // Ingresos por mes (últimos 6) — fecha real del pago si existe
    const revRows = await PlanPayment.findAll({
      where: { status: 'approved' },
      attributes: [
        [fn('DATE_FORMAT', fn('COALESCE', col('paidAt'), col('decidedAt')), '%Y-%m'), 'month'],
        [fn('SUM', col('amount')), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['month'],
      order: [[col('month'), 'ASC']],
      raw: true,
    }) as unknown as Array<{ month: string; total: string; count: number }>;
    const revenueByMonth = revRows.slice(-6).map(r => ({ month: r.month, total: Number(r.total), count: Number(r.count) }));

    // LTV simple por tenant pagador
    const ltvRows = await PlanPayment.findAll({
      where: { status: 'approved' },
      attributes: ['tenantId', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count'], [fn('MIN', col('decidedAt')), 'firstAt']],
      group: ['tenantId'],
      raw: true,
    }) as unknown as Array<{ tenantId: number; total: string; count: number; firstAt: Date }>;
    const nameById = new Map(tenants.map(t => [t.id, { name: t.name, slug: t.slug }]));
    const ltv = ltvRows
      .map(r => ({
        tenantId: r.tenantId,
        name: nameById.get(r.tenantId)?.name ?? `#${r.tenantId}`,
        slug: nameById.get(r.tenantId)?.slug ?? '',
        totalPaid: Number(r.total),
        payments: Number(r.count),
        since: r.firstAt,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid);

    return { mrr, activePaying: activePaying.length, revenueByMonth, upcoming, overdue, noPaidUntil, ltv, graceDays: cfg.graceDays, renewalWarnDays: cfg.renewalWarnDays };
  }

  // Embudo público de los últimos 30 días
  async getFunnel() {
    const { MetricDaily } = await import('./metric-daily.model');
    const { TenantRequest } = await import('./tenant-request.model');
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const sinceStr = since.toISOString().slice(0, 10);

    const metrics = await MetricDaily.findAll({ where: { date: { [Op.gte]: sinceStr } }, raw: true });
    const sum = (key: string) => metrics.filter(m => m.key === key).reduce((s, m) => s + m.count, 0);

    const [requests, approved] = await Promise.all([
      TenantRequest.count({ where: { createdAt: { [Op.gte]: since } } }),
      TenantRequest.count({ where: { createdAt: { [Op.gte]: since }, status: 'approved' } }),
    ]);

    return {
      days: 30,
      landingViews: sum('landing_view'),
      registroViews: sum('registro_view'),
      requests,
      approved,
    };
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

    // Conservar el contacto de la solicitud — antes se perdía al aprobar
    await tenant.update({
      contactName: request.contactName ?? null,
      contactEmail: request.email ?? null,
      contactPhone: request.phone ?? null,
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
      // Cartera = total a crédito sin pagar − abonos registrados
      (async () => {
        const { OrderPayment } = await import('../order/order-payment.model');
        const unpaid = await Order.findAll({
          where: { tenantId, paymentType: 'credit', paidAt: null, status: { [Op.ne]: 'cancelled' } },
          attributes: ['id', 'totalAmount'],
          raw: true,
        }) as unknown as Array<{ id: number; totalAmount: string }>;
        if (unpaid.length === 0) return 0;
        const paid = Number(await OrderPayment.sum('amount', { where: { orderId: unpaid.map(o => o.id) } })) || 0;
        return Math.max(0, unpaid.reduce((s, o) => s + Number(o.totalAmount), 0) - paid);
      })(),
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
      paidUntil: tenant.paidUntil,
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
