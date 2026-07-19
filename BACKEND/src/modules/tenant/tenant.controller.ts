import { Response } from 'express';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { ValidationError } from '@/core/errors/AppError';

const tenantService = new TenantService();

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
    const tenant = await tenantService.getInfo(
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
}
