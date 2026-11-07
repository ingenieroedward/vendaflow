import jwt from 'jsonwebtoken';
import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import { UserService } from '@/modules/user/user.service';
import { LoginDto, JwtPayload } from './auth.dto';
import { AppError, UnauthorizedError, ForbiddenError } from '@/core/errors/AppError';
import { accountKey, lockedMinutesLeft, recordFailure, recordSuccess } from '@/core/auth/loginThrottle';
import { validateSchema } from '@/core/utils/validation';
import { config } from '@/config';
import { loginSchema } from './auth.dto';

// Sesión abierta por impersonación desde el panel superadmin: más corta que la normal
const IMPERSONATION_SESSION = '2h';

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async login(credentials: LoginDto): Promise<{ user: any; token: string; tenant: any }> {
    const validatedData = validateSchema(loginSchema, credentials);

    // Bloqueo por cuenta (v1.17.0): 10 fallos en 15 min → 15 min bloqueada
    const throttleKey = accountKey(validatedData.tenantSlug, validatedData.username);
    const minutes = lockedMinutesLeft(throttleKey);
    if (minutes > 0) {
      throw new AppError(`Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${minutes} min.`, 429);
    }

    try {
      let user: User | null = null;

      if (validatedData.tenantSlug) {
        // Scoped login: resolve slug → tenantId, then find user within that tenant
        const tenant = await Tenant.findOne({ where: { slug: validatedData.tenantSlug } });
        if (!tenant) throw new UnauthorizedError('Invalid username or password');
        user = await User.findOne({
          where: { username: validatedData.username, tenantId: tenant.id },
        });
      } else {
        // No slug: only superadmin may log in without tenant context
        user = await User.findOne({
          where: { username: validatedData.username },
        });
        // Prevent regular users from bypassing tenant isolation by omitting the slug
        if (user && user.role !== 'superadmin') {
          throw new UnauthorizedError('Invalid username or password');
        }
      }

      if (!user) throw new UnauthorizedError('Invalid username or password');

      const isPasswordValid = await user.comparePassword(validatedData.password);
      if (!isPasswordValid) throw new UnauthorizedError('Invalid username or password');

      // 2FA: si el superadmin tiene TOTP activo, exigir el código de 6 dígitos
      // (o un código de respaldo — sin esto, perder el teléfono deja la cuenta
      // bloqueada para siempre: no hay forma de llegar a un endpoint
      // autenticado para desactivar el 2FA sin haber podido iniciar sesión).
      if (user.role === 'superadmin' && user.totpSecret) {
        const { verifyTotp, findBackupCodeIndex } = await import('@/core/totp');
        const code = (validatedData as { totp?: string }).totp;
        if (!code) throw new UnauthorizedError('TOTP_REQUIRED');
        if (!verifyTotp(user.totpSecret, code)) {
          const hashes: string[] = user.totpBackupCodes ? JSON.parse(user.totpBackupCodes) : [];
          const idx = findBackupCodeIndex(hashes, code);
          if (idx === -1) throw new UnauthorizedError('Código de verificación incorrecto');
          // Se consume: un código de respaldo es de un solo uso. No desactiva
          // el 2FA — solo abre esta sesión para poder reconfigurarlo.
          hashes.splice(idx, 1);
          await user.update({ totpBackupCodes: JSON.stringify(hashes) });
        }
      }

      // Fetch tenant separately to avoid association alias issues
      const tenantData = user.tenantId ? await Tenant.findByPk(user.tenantId) : null;

      // Verify tenant is active (superadmin bypasses this check)
      if (user.role !== 'superadmin') {
        if (!tenantData || !tenantData.isActive) {
          throw new ForbiddenError('Cuenta suspendida. Contacta al administrador.');
        }
      }

      recordSuccess(throttleKey);
      const token = this.generateToken(user.id, user.username, user.role, user.tenantId, user.tokenVersion ?? 0);

      return {
        user: { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId },
        token,
        tenant: tenantData ? {
          id: tenantData.id,
          slug: tenantData.slug,
          name: tenantData.name,
          plan: tenantData.plan,
          status: tenantData.status,
          primaryColor: tenantData.primaryColor,
          logoUrl: tenantData.logoUrl,
          trialEndsAt: tenantData.trialEndsAt,
        } : null,
      };
    } catch (err) {
      // Pedir el código 2FA es un paso normal, no un intento fallido
      if (err instanceof UnauthorizedError && err.message !== 'TOTP_REQUIRED') recordFailure(throttleKey);
      throw err;
    }
  }

  /**
   * Canjea un código de impersonación (un solo uso, 2 min) por una sesión de
   * admin del tenant, de 2h. El código debe ser del tenant del subdominio donde
   * se canjea. Misma forma de respuesta que login().
   */
  async exchangeImpersonationCode(code: unknown, tenantSlug: unknown) {
    const { consumeImpersonationCode } = await import('@/core/auth/impersonationCodes');
    const entry = consumeImpersonationCode(String(code ?? ''));
    if (!entry) throw new UnauthorizedError('Código de acceso inválido o vencido');

    const [user, tenantData] = await Promise.all([User.findByPk(entry.userId), Tenant.findByPk(entry.tenantId)]);
    if (!user || !tenantData || user.tenantId !== tenantData.id || tenantData.slug !== String(tenantSlug ?? '')) {
      throw new UnauthorizedError('Código de acceso inválido o vencido');
    }
    if (!tenantData.isActive) throw new ForbiddenError('Cuenta suspendida. Contacta al administrador.');

    const token = this.generateToken(user.id, user.username, user.role, user.tenantId, user.tokenVersion ?? 0, IMPERSONATION_SESSION);
    return {
      user: { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId },
      token,
      tenant: {
        id: tenantData.id,
        slug: tenantData.slug,
        name: tenantData.name,
        plan: tenantData.plan,
        status: tenantData.status,
        primaryColor: tenantData.primaryColor,
        logoUrl: tenantData.logoUrl,
        trialEndsAt: tenantData.trialEndsAt,
      },
    };
  }

  async getCurrentUser(userId: number, tenantId: number) {
    return await this.userService.getUserById(userId, tenantId);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid token');
    }
  }

  generateToken(userId: number, username: string, role: string, tenantId: number, tokenVersion = 0, expiresIn?: string): string {
    const payload: JwtPayload = { userId, username, role: role as any, tenantId, tv: tokenVersion };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: (expiresIn ?? config.jwt.expiresIn) as any });
  }
}
