import jwt from 'jsonwebtoken';
import { User } from '@/modules/user/user.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import { UserService } from '@/modules/user/user.service';
import { LoginDto, JwtPayload } from './auth.dto';
import { UnauthorizedError, ForbiddenError } from '@/core/errors/AppError';
import { validateSchema } from '@/core/utils/validation';
import { config } from '@/config';
import { loginSchema } from './auth.dto';

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async login(credentials: LoginDto): Promise<{ user: any; token: string; tenant: any }> {
    const validatedData = validateSchema(loginSchema, credentials);

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

    // Fetch tenant separately to avoid association alias issues
    const tenantData = user.tenantId ? await Tenant.findByPk(user.tenantId) : null;

    // Verify tenant is active (superadmin bypasses this check)
    if (user.role !== 'superadmin') {
      if (!tenantData || !tenantData.isActive) {
        throw new ForbiddenError('Cuenta suspendida. Contacta al administrador.');
      }
    }

    const token = this.generateToken(user.id, user.username, user.role, user.tenantId);

    return {
      user: { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId },
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

  generateToken(userId: number, username: string, role: string, tenantId: number): string {
    const payload: JwtPayload = { userId, username, role: role as any, tenantId };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });
  }
}
