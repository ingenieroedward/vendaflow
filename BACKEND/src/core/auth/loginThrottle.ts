// Bloqueo por cuenta ante fuerza bruta (v1.17.0). El rate limit de /api/auth es
// por IP (20/15min): un ataque repartido entre muchas IPs no se frenaba. Aquí
// se cuentan los fallos por cuenta (tenant + usuario), sin importar la IP.
// 10 fallos en 15 min bloquean la cuenta 15 min; un login correcto reinicia.
// Umbral alto a propósito: más bajo, un atacante podría bloquearle la cuenta a
// un usuario real con muy pocos intentos.

export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;

interface State { failures: number; firstAt: number; lockedUntil: number }
const states = new Map<string, State>();

export const accountKey = (tenantSlug: string | undefined, username: string) =>
  `${(tenantSlug ?? '').toLowerCase()}:${username.trim().toLowerCase()}`;

/** Minutos que faltan si la cuenta está bloqueada; 0 si puede intentar. */
export function lockedMinutesLeft(key: string, now = Date.now()): number {
  const s = states.get(key);
  if (!s || s.lockedUntil <= now) return 0;
  return Math.ceil((s.lockedUntil - now) / 60_000);
}

export function recordFailure(key: string, now = Date.now()): void {
  let s = states.get(key);
  if (!s || now - s.firstAt > WINDOW_MS) s = { failures: 0, firstAt: now, lockedUntil: 0 };
  s.failures += 1;
  if (s.failures >= MAX_FAILURES) {
    s.lockedUntil = now + LOCK_MS;
    s.failures = 0;
    s.firstAt = now;
  }
  states.set(key, s);
  if (states.size > 10_000) for (const [k, v] of states) if (v.lockedUntil <= now && now - v.firstAt > WINDOW_MS) states.delete(k);
}

export function recordSuccess(key: string): void {
  states.delete(key);
}
