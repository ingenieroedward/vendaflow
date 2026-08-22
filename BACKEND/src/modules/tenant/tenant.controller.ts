import { Response } from 'express';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { ValidationError } from '@/core/errors/AppError';

const tenantService = new TenantService();

// Auditoría best-effort de acciones del superadmin (nunca rompe la acción)
const audit = (req: AuthenticatedRequest, action: string, tenantId?: number | null, tenantSlug?: string | null, meta?: Record<string, unknown>) => {
  import('./audit-log.model').then(({ logAudit }) => logAudit({
    userId: req.user!.id, username: req.user!.username, action,
    tenantId: tenantId ?? null, tenantSlug: tenantSlug ?? null,
    ...(meta !== undefined && { meta }),
    ip: req.ip ?? null,
  })).catch(() => {});
};

const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).optional(),
  trialEndsAt: z.string().nullable().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxProducts: z.number().int().positive().optional(),
  maxOrdersPerMonth: z.number().int().positive().optional(),
  customPrice: z.number().nonnegative().nullable().optional(),
  customFeatures: z.array(z.string()).nullable().optional(), // null = usar default del plan
  contactName: z.string().max(120).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional().or(z.literal('').transform(() => null)),
  contactPhone: z.string().max(30).nullable().optional(),
});

const createTenantSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  name: z.string().min(2).max(255),
  plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).optional(),
  adminUsername: z.string().min(3).max(100),
  adminPassword: z.string().min(6),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export class TenantController {
  getBySlug = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.getPublicInfo(
      (await tenantService.findBySlug(req.params['slug']!)).id
    );
    res.json(tenant);
  });

  getMyTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.getInfo(req.user!.tenantId);
    res.json(tenant);
  });

  updateTheme = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.updateTheme(req.user!.tenantId, req.body);
    res.json(tenant);
  });

  createTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = createTenantSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message ?? 'Datos inválidos');
    const { slug, name, plan, adminUsername, adminPassword, primaryColor } = result.data;
    const tenant = await tenantService.create({
      slug,
      name,
      adminUsername,
      adminPassword,
      ...(plan !== undefined && { plan }),
      ...(primaryColor !== undefined && { primaryColor }),
    });
    audit(req, 'tenant_create', tenant.id, tenant.slug, { plan: tenant.plan });
    res.status(201).json(tenant);
  });

  listAll = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const tenants = await tenantService.listAll();
    res.json(tenants);
  });

  suspend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.suspend(Number(req.params['id']!));
    audit(req, 'tenant_suspend', tenant.id, tenant.slug);
    res.json(tenant);
  });

  activate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.activate(Number(req.params['id']!));
    audit(req, 'tenant_activate', tenant.id, tenant.slug);
    res.json(tenant);
  });

  cancelTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.cancelTenant(Number(req.params['id']!));
    audit(req, 'tenant_cancel', tenant.id, tenant.slug);
    res.json(tenant);
  });

  purgeTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.purgeTenant(Number(req.params['id']!));
    audit(req, 'tenant_purge', result.tenantId, result.slug);
    res.json({ status: 'success', data: result });
  });

  getBilling = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getBilling(req.user!.tenantId) });
  });

  reportPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { plan, amount, months, reference, receiptBase64, receiptMime } = req.body ?? {};
    if (!plan || !amount) throw new ValidationError('plan y amount son requeridos');
    const result = await tenantService.reportPayment(req.user!.tenantId, {
      plan: String(plan), amount: Number(amount), months: Number(months ?? 1), reference, receiptBase64, receiptMime,
    });
    res.status(201).json({ status: 'success', data: result });
  });

  listPayments = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.listPayments() });
  });

  getPaymentReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getPaymentReceipt(Number(req.params['id']!)) });
  });

  approvePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payment = await tenantService.decidePayment(Number(req.params['id']!), true);
    audit(req, 'payment_approve', payment.tenantId, null, { receipt: payment.receiptNumber, amount: Number(payment.amount) });
    res.json({ status: 'success', data: payment });
  });

  rejectPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const payment = await tenantService.decidePayment(Number(req.params['id']!), false, req.body?.reason);
    audit(req, 'payment_reject', payment.tenantId, null, { reason: req.body?.reason ?? null });
    res.json({ status: 'success', data: payment });
  });

  registerPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { plan, amount, months, method, paidAt, reference, notes } = req.body ?? {};
    if (amount === undefined) throw new ValidationError('amount es requerido');
    const result = await tenantService.registerManualPayment(Number(req.params['id']), {
      plan, amount: Number(amount), months, method, paidAt, reference, notes,
    });
    audit(req, 'payment_register', Number(req.params['id']), null, {
      receipt: result.receiptNumber, amount: Number(amount), months: result.months, plan: result.plan,
    });
    res.status(201).json({ status: 'success', data: result });
  });

  listAudit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { PlatformAuditLog } = await import('./audit-log.model');
    const limit = Math.min(200, Math.max(1, Number(req.query['limit'] ?? 100)));
    const rows = await PlatformAuditLog.findAll({ order: [['id', 'DESC']], limit, raw: true });
    res.json({ status: 'success', data: rows });
  });

  getFinance = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getFinance() });
  });

  getFunnel = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getFunnel() });
  });

  getPlatformSettings = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getPlatformSettings() });
  });

  updatePlatformSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { brebKey, brebHolder, prices, renewalWarnDays, graceDays, planFeatures } = req.body ?? {};
    res.json({ status: 'success', data: await tenantService.updatePlatformSettings({ brebKey, brebHolder, prices, renewalWarnDays, graceDays, planFeatures }) });
  });

  listRequests = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.listRequests() });
  });

  approveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { slug, adminUsername, adminPassword, plan, primaryColor } = req.body ?? {};
    if (!slug || !adminUsername || !adminPassword) throw new ValidationError('slug, adminUsername y adminPassword son requeridos');
    const result = await tenantService.approveRequest(Number(req.params['id']!), { slug, adminUsername, adminPassword, plan, primaryColor });
    audit(req, 'request_approve', null, slug);
    res.json({ status: 'success', data: result });
  });

  rejectRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.rejectRequest(Number(req.params['id']!));
    audit(req, 'request_reject', null, null, { requestId: Number(req.params['id']) });
    res.json({ status: 'success', data: result });
  });

  impersonate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.impersonate(Number(req.params['id']!));
    audit(req, 'impersonate', Number(req.params['id']), result.slug, { asUser: result.username });
    res.json({ status: 'success', data: result });
  });

  getDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.getDetail(Number(req.params['id']!));
    res.json({ status: 'success', data: result });
  });

  broadcast = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId, onlyAdmins, title, body } = req.body ?? {};
    if (!title || !body) throw new ValidationError('title y body son requeridos');
    const result = await tenantService.broadcast({ tenantId, onlyAdmins, title: String(title), body: String(body) });
    audit(req, 'broadcast', tenantId ?? null, null, { title: String(title).slice(0, 80), recipients: result.recipients });
    res.json({ status: 'success', data: result });
  });

  platformStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.getPlatformStats();
    res.json({ status: 'success', data: result });
  });

  exportData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.exportTenantData(Number(req.params['id']!));
    audit(req, 'tenant_export', Number(req.params['id']), result.tenant.slug);
    res.setHeader('Content-Disposition', `attachment; filename="tenant-${result.tenant.slug}-export.json"`);
    res.json(result);
  });

  updateTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = updateTenantSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message ?? 'Datos inválidos');
    const tenant = await tenantService.update(Number(req.params['id']!), result.data);
    audit(req, 'tenant_update', tenant.id, tenant.slug, { fields: Object.keys(result.data) });
    res.json(tenant);
  });
}
