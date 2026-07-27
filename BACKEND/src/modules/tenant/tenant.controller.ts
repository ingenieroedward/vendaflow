import { Response } from 'express';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { ValidationError } from '@/core/errors/AppError';

const tenantService = new TenantService();

const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).optional(),
  trialEndsAt: z.string().nullable().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxProducts: z.number().int().positive().optional(),
  maxOrdersPerMonth: z.number().int().positive().optional(),
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
    res.status(201).json(tenant);
  });

  listAll = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const tenants = await tenantService.listAll();
    res.json(tenants);
  });

  suspend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.suspend(Number(req.params['id']!));
    res.json(tenant);
  });

  activate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.activate(Number(req.params['id']!));
    res.json(tenant);
  });

  getBilling = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.getBilling(req.user!.tenantId) });
  });

  reportPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { plan, amount, reference, receiptBase64, receiptMime } = req.body ?? {};
    if (!plan || !amount) throw new ValidationError('plan y amount son requeridos');
    const result = await tenantService.reportPayment(req.user!.tenantId, {
      plan: String(plan), amount: Number(amount), reference, receiptBase64, receiptMime,
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
    res.json({ status: 'success', data: await tenantService.decidePayment(Number(req.params['id']!), true) });
  });

  rejectPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.decidePayment(Number(req.params['id']!), false, req.body?.reason) });
  });

  listRequests = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.listRequests() });
  });

  approveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { slug, adminUsername, adminPassword, plan, primaryColor } = req.body ?? {};
    if (!slug || !adminUsername || !adminPassword) throw new ValidationError('slug, adminUsername y adminPassword son requeridos');
    const result = await tenantService.approveRequest(Number(req.params['id']!), { slug, adminUsername, adminPassword, plan, primaryColor });
    res.json({ status: 'success', data: result });
  });

  rejectRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ status: 'success', data: await tenantService.rejectRequest(Number(req.params['id']!)) });
  });

  impersonate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.impersonate(Number(req.params['id']!));
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
    res.json({ status: 'success', data: result });
  });

  platformStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.getPlatformStats();
    res.json({ status: 'success', data: result });
  });

  exportData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await tenantService.exportTenantData(Number(req.params['id']!));
    res.setHeader('Content-Disposition', `attachment; filename="tenant-${result.tenant.slug}-export.json"`);
    res.json(result);
  });

  updateTenant = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = updateTenantSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message ?? 'Datos inválidos');
    const tenant = await tenantService.update(Number(req.params['id']!), result.data);
    res.json(tenant);
  });
}
