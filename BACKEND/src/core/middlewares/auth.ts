import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';

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
