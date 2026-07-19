import { Response } from 'express';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';

const tenantService = new TenantService();

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
