import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import type { FeatureKey } from '@/config/features';

const authService = new AuthService();

export type AuthenticatedRequest = Request;

export const isAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Access token required');

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);

    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
      tenantId: payload.tenantId,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const isAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    next(new ForbiddenError('Admin access required')); return;
  }
  next();
};

export const isSuperAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
  if (req.user.role !== 'superadmin') { next(new ForbiddenError('Super-admin access required')); return; }
  next();
};

export const isSeller = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
  if (!['seller', 'admin', 'superadmin'].includes(req.user.role)) {
    next(new ForbiddenError('Seller access required')); return;
  }
  next();
};

export const isBuyer = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
  if (!['buyer', 'admin', 'superadmin'].includes(req.user.role)) {
    next(new ForbiddenError('Buyer access required')); return;
  }
  next();
};

/**
 * Gatea una ruta por feature del plan (ej. 'pos'). Requiere isAuth antes en
 * la cadena (usa req.user.tenantId). superadmin siempre pasa — administra
 * la plataforma, no debe quedar bloqueado por el plan de ningún tenant.
 */
export const requireFeature = (feature: FeatureKey) =>
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
      if (req.user.role === 'superadmin') { next(); return; }

      const { Tenant } = await import('@/modules/tenant/tenant.model');
      const { resolveFeatures } = await import('@/config/features');
      const { getPlanConfig } = await import('@/config/plans');
      const [tenant, cfg] = await Promise.all([
        Tenant.findByPk(req.user.tenantId, { attributes: ['plan', 'customFeatures'] }),
        getPlanConfig(),
      ]);
      if (!tenant || !resolveFeatures(tenant, cfg.planFeatures).has(feature)) {
        next(new ForbiddenError(`Esta función requiere un plan superior. Contáctanos para activar "${feature}".`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { next(); return; }
    const payload = authService.verifyToken(authHeader.substring(7));
    req.user = { id: payload.userId, username: payload.username, role: payload.role, tenantId: payload.tenantId };
    next();
  } catch {
    next();
  }
};
