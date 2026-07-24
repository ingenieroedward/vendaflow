import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { ForbiddenError } from '../errors/AppError';
import { Tenant } from '@/modules/tenant/tenant.model';

// Cache en memoria del estado del tenant — evita una consulta a DB por request.
// Una suspensión tarda como máximo TTL en aplicar sobre sesiones activas.
const CACHE_TTL_MS = 60_000;
const statusCache = new Map<number, { isActive: boolean; expiresAt: number }>();

async function isTenantActive(tenantId: number): Promise<boolean> {
  const cached = statusCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.isActive;

  const tenant = await Tenant.findByPk(tenantId);
  const isActive = !!tenant && tenant.isActive;
  statusCache.set(tenantId, { isActive, expiresAt: Date.now() + CACHE_TTL_MS });
  return isActive;
}

/**
 * Capa extra de defensa multi-tenant sobre las rutas de negocio:
 * bloquea usuarios de tenants suspendidos/cancelados/eliminados aunque
 * su JWT siga vigente. Superadmin bypassa el check.
 */
export const tenantScope = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) { next(new ForbiddenError('Authentication required')); return; }

    if (req.user.role === 'superadmin') { next(); return; }

    if (!(await isTenantActive(req.user.tenantId))) {
      next(new ForbiddenError('Cuenta suspendida. Contacta al administrador.'));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};
