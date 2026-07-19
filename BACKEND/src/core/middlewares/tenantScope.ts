import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { ForbiddenError } from '../errors/AppError';
import { Tenant } from '@/modules/tenant/tenant.model';

/**
 * Verifica que el tenant del usuario esté activo.
 * Inyecta req.tenantId para que los services lo usen.
 * Superadmin bypassa el check de tenant.
 */
export const tenantScope = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) { next(new ForbiddenError('Authentication required')); return; }

    if (req.user.role === 'superadmin') { next(); return; }

    const tenant = await Tenant.findByPk(req.user.tenantId);
    if (!tenant || !tenant.isActive) {
      next(new ForbiddenError('Cuenta suspendida. Contacta al administrador.'));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};
