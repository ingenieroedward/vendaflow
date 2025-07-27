import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'buyer' | 'seller' | 'admin';
  };
}

export const isAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = authService.verifyToken(token);

    // Add user info to request
    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const isAdmin = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new ForbiddenError('Admin access required'));
    return;
  }

  next();
};

export const isBuyer = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  if (req.user.role !== 'buyer' && req.user.role !== 'admin') {
    next(new ForbiddenError('Buyer access required'));
    return;
  }

  next();
};

export const isSeller = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    next(new ForbiddenError('Seller access required'));
    return;
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
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);

    // Add user info to request
    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
    };

    next();
  } catch (error) {
    // Continue without authentication on token error
    next();
  }
}; 