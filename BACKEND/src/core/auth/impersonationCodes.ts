import crypto from 'crypto';

// Códigos de un solo uso para impersonar desde el panel superadmin (v1.17.0).
// Antes el panel recibía un JWT de admin de 24h y lo pasaba en la URL
// (/login?impersonate=<jwt>), donde quedaba en el historial del navegador y en
// logs. Ahora la URL lleva un código opaco que vence en 2 min, sirve una sola
// vez y se canjea por POST /api/auth/impersonate. En memoria: hay una sola
// instancia del backend y un reinicio solo invalida códigos de 2 min.

export const IMPERSONATION_CODE_TTL_MS = 2 * 60_000;

interface Entry { userId: number; tenantId: number; expiresAt: number }
const codes = new Map<string, Entry>();

function prune(now: number): void {
  for (const [code, e] of codes) if (e.expiresAt <= now) codes.delete(code);
}

export function issueImpersonationCode(userId: number, tenantId: number, now = Date.now()): string {
  prune(now);
  const code = crypto.randomBytes(32).toString('base64url');
  codes.set(code, { userId, tenantId, expiresAt: now + IMPERSONATION_CODE_TTL_MS });
  return code;
}

/** Devuelve a quién impersonar y borra el código (un solo uso). null si no existe o venció. */
export function consumeImpersonationCode(code: string, now = Date.now()): { userId: number; tenantId: number } | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  const entry = codes.get(code);
  codes.delete(code);
  if (!entry || entry.expiresAt <= now) return null;
  return { userId: entry.userId, tenantId: entry.tenantId };
}
