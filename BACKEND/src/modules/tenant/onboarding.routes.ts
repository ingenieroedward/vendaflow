import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { ValidationError } from '@/core/errors/AppError';
import { config } from '@/config';
import { TenantRequest } from './tenant-request.model';
import { User } from '@/modules/user/user.model';
import { pushService } from '@/modules/push/push.service';
import logger from '@/core/logger';

const router = Router();

// Rate limit estricto: es un formulario público
const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { status: 'error', message: 'Demasiadas solicitudes, intenta más tarde.' },
});

// ── Captcha propio (sin servicios externos) ─────────────────────────────────
// GET /captcha entrega una suma y un token HMAC firmado; POST /request la valida.
const captchaSign = (a: number, b: number, exp: number) =>
  crypto.createHmac('sha256', config.jwt.secret).update(`captcha:${a}:${b}:${exp}`).digest('hex');

router.get('/captcha', onboardingLimiter, (_req: Request, res: Response) => {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const exp = Date.now() + 10 * 60 * 1000;
  res.json({ question: `¿Cuánto es ${a} + ${b}?`, a, b, exp, token: captchaSign(a, b, exp) });
});

// Tracking del embudo público (contador diario, sin cookies ni datos personales)
const VALID_EVENTS = new Set(['landing_view', 'registro_view']);
router.post('/track', asyncHandler(async (req: Request, res: Response) => {
  const event = String(req.body?.event ?? '');
  if (VALID_EVENTS.has(event)) {
    const { MetricDaily } = await import('./metric-daily.model');
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await MetricDaily.findOrCreate({ where: { date: today, key: event }, defaults: { date: today, key: event, count: 0 } });
    await row.increment('count');
  }
  res.status(204).end();
}));

// Precios públicos para la landing (sin llave Bre-B)
router.get('/plans', asyncHandler(async (_req: Request, res: Response) => {
  const { getPlanConfig } = await import('@/config/plans');
  const cfg = await getPlanConfig();
  res.set('Cache-Control', 'public, max-age=300').json({ prices: cfg.prices });
}));

const requestSchema = z.object({
  companyName: z.string().min(2).max(255),
  contactName: z.string().min(2).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  message: z.string().max(1000).optional(),
  // anti-bot
  website: z.string().optional(), // honeypot: los humanos lo dejan vacío
  captcha: z.object({ a: z.number(), b: z.number(), exp: z.number(), token: z.string(), answer: z.number() }),
});

/**
 * POST /api/onboarding/request — solicitud pública de registro.
 * NO crea el tenant: queda pendiente de aprobación del superadmin (push de aviso).
 * (El antiguo POST /register que creaba tenants sin aprobación fue eliminado.)
 */
router.post('/request', onboardingLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Datos inválidos');
  const d = parsed.data;

  // Honeypot: los bots lo rellenan — responder como éxito sin guardar
  if (d.website && d.website.trim() !== '') {
    res.status(201).json({ status: 'success', message: 'Solicitud recibida' });
    return;
  }

  // Captcha: firma válida, no expirado y respuesta correcta
  const { a, b, exp, token, answer } = d.captcha;
  if (exp < Date.now() || token !== captchaSign(a, b, exp) || answer !== a + b) {
    throw new ValidationError('Verificación incorrecta — resuelve la suma de nuevo');
  }

  // Evitar duplicados pendientes del mismo email
  const existing = await TenantRequest.findOne({ where: { email: d.email, status: 'pending' } });
  if (!existing) {
    await TenantRequest.create({
      companyName: d.companyName,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone ?? null,
      message: d.message ?? null,
      status: 'pending',
      tenantId: null,
    });

    try {
      const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
      await pushService.notifyUsers(
        superadmins.map(u => u.id),
        'Nueva solicitud de registro',
        `${d.companyName} — ${d.contactName} (${d.email}${d.phone ? `, ${d.phone}` : ''})`,
        { url: '/superadmin' },
      );
    } catch (err) {
      logger.error('[onboarding] Error notificando solicitud:', err);
    }
  }

  res.status(201).json({ status: 'success', message: 'Solicitud recibida — te contactaremos pronto' });
}));

export default router;
