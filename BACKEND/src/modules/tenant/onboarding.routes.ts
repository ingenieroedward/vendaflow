import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthService } from '@/modules/auth/auth.service';
import { ValidationError } from '@/core/errors/AppError';

const router = Router();
const tenantService = new TenantService();
const authService = new AuthService();

const registerSchema = z.object({
  companyName: z.string().min(2).max(255),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  adminUsername: z.string().min(3).max(100),
  adminPassword: z.string().min(8),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).optional(),
});

/**
 * POST /api/onboarding/register
 * Crea un nuevo tenant + usuario admin en una transacción.
 * Devuelve token JWT listo para usar.
 */
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const data = registerSchema.safeParse(req.body);
  if (!data.success) throw new ValidationError(data.error.errors[0]?.message ?? 'Datos inválidos');

  const { companyName, slug, adminUsername, adminPassword, primaryColor, plan } = data.data;

  const tenant = await tenantService.create({
    slug,
    name: companyName,
    ...(plan !== undefined && { plan }),
    adminUsername,
    adminPassword,
    ...(primaryColor !== undefined && { primaryColor }),
  });

  const tenantInfo = await tenantService.getInfo(tenant.id);

  // Find the created admin user to generate token
  const { User } = await import('@/modules/user/user.model');
  const admin = await User.findOne({ where: { tenantId: tenant.id, role: 'admin' } });
  if (!admin) throw new Error('Error creating admin user');

  const token = authService.generateToken(admin.id, admin.username, admin.role, admin.tenantId);

  res.status(201).json({
    message: 'Empresa registrada exitosamente',
    token,
    user: { id: admin.id, username: admin.username, role: admin.role, tenantId: admin.tenantId },
    tenant: tenantInfo,
  });
}));

export default router;
