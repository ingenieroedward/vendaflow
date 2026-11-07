import { User } from '@/modules/user/user.model';
import type { JwtPayload } from '@/modules/auth/auth.dto';

// Revocación de sesiones (v1.16.9). El JWT dura 24h y antes se aceptaba sin
// mirar la BD: un usuario eliminado, degradado de rol o con contraseña cambiada
// seguía entrando con su token. Ahora cada request compara el token contra el
// estado actual del usuario (cacheado 60s, mismo patrón que tenantScope).

export interface SessionUser {
  role: JwtPayload['role'];
  tenantId: number;
  tokenVersion: number;
}

/** Regla pura: ¿este token sigue representando al usuario tal como está hoy? */
export function isSessionValid(payload: JwtPayload, user: SessionUser | null): boolean {
  if (!user) return false; // eliminado (soft delete) o inexistente
  if (user.tenantId !== payload.tenantId) return false;
  if (user.role !== payload.role) return false; // rol cambiado → re-login con el rol real
  return (payload.tv ?? 0) === user.tokenVersion; // tokens previos a v1.16.9 no traen tv = 0
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<number, { user: SessionUser | null; expiresAt: number }>();

export async function getSessionUser(userId: number): Promise<SessionUser | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.user;

  const row = await User.findByPk(userId, { attributes: ['role', 'tenantId', 'tokenVersion'] });
  const user = row ? { role: row.role, tenantId: row.tenantId, tokenVersion: row.tokenVersion ?? 0 } : null;
  cache.set(userId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
  return user;
}

/** Llamar tras eliminar/restaurar un usuario o cambiar su rol, contraseña o tokenVersion. */
export function invalidateSession(userId: number): void {
  cache.delete(userId);
}
