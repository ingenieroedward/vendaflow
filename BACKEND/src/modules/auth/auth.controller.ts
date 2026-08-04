import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { UnauthorizedError } from '@/core/errors/AppError';

export class AuthController {
  totpSetup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { generateTotpSecret, totpUri } = await import('@/core/totp');
    const secret = generateTotpSecret();
    res.json({ status: 'success', data: { secret, uri: totpUri(secret, req.user!.username) } });
  });

  totpEnable = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { verifyTotp } = await import('@/core/totp');
    const { User } = await import('@/modules/user/user.model');
    const { secret, code } = req.body ?? {};
    if (!secret || !code) throw new UnauthorizedError('secret y code son requeridos');
    if (!verifyTotp(String(secret), String(code))) throw new UnauthorizedError('Código incorrecto — revisa la app autenticadora');
    await User.update({ totpSecret: String(secret) }, { where: { id: req.user!.id } });
    res.json({ status: 'success', message: '2FA activado' });
  });

  totpDisable = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { verifyTotp } = await import('@/core/totp');
    const { User } = await import('@/modules/user/user.model');
    const user = await User.findByPk(req.user!.id);
    if (!user?.totpSecret) { res.json({ status: 'success', message: '2FA ya estaba inactivo' }); return; }
    if (!verifyTotp(user.totpSecret, String(req.body?.code ?? ''))) {
      throw new UnauthorizedError('Código incorrecto');
    }
    await user.update({ totpSecret: null });
    res.json({ status: 'success', message: '2FA desactivado' });
  });

  totpStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { User } = await import('@/modules/user/user.model');
    const user = await User.findByPk(req.user!.id, { attributes: ['totpSecret'] });
    res.json({ status: 'success', data: { enabled: Boolean(user?.totpSecret) } });
  });

  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // POST /api/auth/login
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/auth/me
  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.authService.getCurrentUser(req.user!.id, req.user!.tenantId);
    res.status(200).json({ status: 'success', data: user });
  });
}
