import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { TenantService } from './tenant.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthService } from '@/modules/auth/auth.service';
import { ForbiddenError, ValidationError } from '@/core/errors/AppError';
import { config } from '@/config';
import logger from '@/core/logger';

const router = Router();
const tenantService = new TenantService();
const authService = new AuthService();

// Subdominios que no pueden usarse como slug de tenant
const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'superadmin', 'merco', 'edwsystem', 'mail', 'blog',
  'docs', 'help', 'soporte', 'status', 'staging', 'dev', 'test', 'demo', 'login', 'registro',
]);

// Anti-abuso: máx 5 registros por IP por hora
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiados registros desde esta red. Intenta de nuevo en una hora.',
  },
});

// El plan NO se acepta desde el cliente: todo registro público inicia en 'trial'.
// Planes pagos se asignan solo desde el panel superadmin.
const registerSchema = z.object({
  companyName: z.string().trim().min(2).max(255),
  slug: z.string().trim().toLowerCase().min(3).max(50)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo letras minúsculas, números y guiones'),
  adminUsername: z.string().trim().min(3).max(100),
  adminPassword: z.string().min(8).max(128),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  promoCode: z.string().trim().max(50).optional(),
  // Honeypot: campo oculto en el formulario, los humanos lo dejan vacío
  website: z.string().optional(),
});

/**
 * GET /api/onboarding/promo/:code
 * Valida un código promocional y devuelve los días de prueba que otorga.
 */
router.get('/promo/:code', signupLimiter, (req: Request, res: Response) => {
  const days = config.saas.promoCodes[String(req.params['code'] ?? '').toUpperCase()];
  res.json({ valid: !!days, trialDays: days ?? config.saas.defaultTrialDays });
});

/**
 * POST /api/onboarding/register
 * Crea un nuevo tenant (plan trial) + usuario admin en una transacción.
 * Devuelve token JWT listo para usar.
 */
router.post('/register', signupLimiter, asyncHandler(async (req: Request, res: Response) => {
  if (!config.saas.publicSignupEnabled) throw new ForbiddenError('El registro público está deshabilitado');

  const data = registerSchema.safeParse(req.body);
  if (!data.success) throw new ValidationError(data.error.errors[0]?.message ?? 'Datos inválidos');

  const { companyName, slug, adminUsername, adminPassword, primaryColor, promoCode, website } = data.data;

  if (website) {
    // Bot detectado por honeypot — responder genérico sin crear nada
    logger.warn('Onboarding honeypot triggered', { ip: req.ip, slug });
    throw new ValidationError('Datos inválidos');
  }

  if (RESERVED_SLUGS.has(slug)) throw new ValidationError(`El subdominio "${slug}" no está disponible`);

  const promoDays = promoCode ? config.saas.promoCodes[promoCode.toUpperCase()] : undefined;

  const tenant = await tenantService.create({
    slug,
    name: companyName,
    plan: 'trial',
    adminUsername,
    adminPassword,
    ...(primaryColor !== undefined && { primaryColor }),
    ...(promoDays !== undefined && { trialDays: promoDays }),
  });

  logger.info('New tenant registered', { tenantId: tenant.id, slug, promoCode: promoDays ? promoCode : null });

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
