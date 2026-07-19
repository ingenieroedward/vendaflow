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

    const user = await User.findOne({
      where: { username: validatedData.username },
      include: [{ model: Tenant, as: 'tenant' }],
    });
    if (!user) throw new UnauthorizedError('Invalid username or password');

    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) throw new UnauthorizedError('Invalid username or password');

    // Verify tenant is active (superadmin bypasses this)
    if (user.role !== 'superadmin') {
      const tenant = (user as any).tenant as Tenant;
      if (!tenant || !tenant.isActive) {
        throw new ForbiddenError('Cuenta suspendida. Contacta al administrador.');
      }
    }

    const token = this.generateToken(user.id, user.username, user.role, user.tenantId);

    return {
      user: { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId },
      token,
      tenant: (user as any).tenant ? {
        name: (user as any).tenant.name,
        slug: (user as any).tenant.slug,
        primaryColor: (user as any).tenant.primaryColor,
        logoUrl: (user as any).tenant.logoUrl,
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
