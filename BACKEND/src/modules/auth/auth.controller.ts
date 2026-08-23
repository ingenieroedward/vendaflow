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
    const { verifyTotp, generateBackupCodes, hashBackupCode } = await import('@/core/totp');
    const { User } = await import('@/modules/user/user.model');
    const { secret, code } = req.body ?? {};
    if (!secret || !code) throw new UnauthorizedError('secret y code son requeridos');
    if (!verifyTotp(String(secret), String(code))) throw new UnauthorizedError('Código incorrecto — revisa la app autenticadora');
    // Códigos de respaldo generados junto con el 2FA — sin esto, perder el
    // teléfono deja la cuenta bloqueada para siempre (ver auth.service.ts).
    // El texto plano solo se devuelve esta vez; de aquí en adelante solo se
    // guardan los hashes.
    const backupCodes = generateBackupCodes();
    await User.update(
      { totpSecret: String(secret), totpBackupCodes: JSON.stringify(backupCodes.map(hashBackupCode)) },
      { where: { id: req.user!.id } },
    );
    res.json({ status: 'success', message: '2FA activado', data: { backupCodes } });
  });

  totpDisable = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { verifyTotp, findBackupCodeIndex } = await import('@/core/totp');
    const { User } = await import('@/modules/user/user.model');
    const user = await User.findByPk(req.user!.id);
    if (!user?.totpSecret) { res.json({ status: 'success', message: '2FA ya estaba inactivo' }); return; }
    const code = String(req.body?.code ?? '');
    const validTotp = verifyTotp(user.totpSecret, code);
    const validBackup = !validTotp && findBackupCodeIndex(user.totpBackupCodes ? JSON.parse(user.totpBackupCodes) : [], code) !== -1;
    if (!validTotp && !validBackup) throw new UnauthorizedError('Código incorrecto');
    await user.update({ totpSecret: null, totpBackupCodes: null });
    res.json({ status: 'success', message: '2FA desactivado' });
  });

  // Genera un set nuevo de códigos de respaldo, invalidando los anteriores —
  // para cuando se están agotando o se sospecha que alguno se filtró. Exige
  // un TOTP válido (no un código de respaldo) para no dejar que quien robó
  // un solo código de respaldo pueda regenerar el resto por su cuenta.
  totpBackupRegenerate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { verifyTotp, generateBackupCodes, hashBackupCode } = await import('@/core/totp');
    const { User } = await import('@/modules/user/user.model');
    const user = await User.findByPk(req.user!.id);
    if (!user?.totpSecret) throw new UnauthorizedError('El 2FA no está activo');
    if (!verifyTotp(user.totpSecret, String(req.body?.code ?? ''))) throw new UnauthorizedError('Código incorrecto');
    const backupCodes = generateBackupCodes();
    await user.update({ totpBackupCodes: JSON.stringify(backupCodes.map(hashBackupCode)) });
    res.json({ status: 'success', data: { backupCodes } });
  });

  totpStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { User } = await import('@/modules/user/user.model');
    const user = await User.findByPk(req.user!.id, { attributes: ['totpSecret', 'totpBackupCodes'] });
    const backupCodesRemaining = user?.totpBackupCodes ? (JSON.parse(user.totpBackupCodes) as string[]).length : 0;
    res.json({ status: 'success', data: { enabled: Boolean(user?.totpSecret), backupCodesRemaining } });
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
