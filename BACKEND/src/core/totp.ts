import crypto from 'crypto';

// TOTP (RFC 6238) con crypto nativo — sin dependencias externas.
// Compatible con Google Authenticator, Authy, 1Password, etc.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

/** Verifica un código TOTP con ventana de ±1 período (30s) para tolerar desfase de reloj */
export function verifyTotp(secret: string, code: string, now: number = Date.now()): boolean {
  const clean = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const key = base32Decode(secret);
  if (key.length === 0) return false;
  const counter = Math.floor(now / 1000 / 30);
  for (const w of [0, -1, 1]) {
    const expected = hotp(key, counter + w);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
}

/** URI otpauth:// para apps autenticadoras (entrada manual o QR) */
export function totpUri(secret: string, account: string, issuer = 'Merco'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---- Códigos de respaldo ----
// Sin esto, perder el dispositivo con la app autenticadora deja la cuenta
// de superadmin bloqueada para siempre (login exige el código y no hay
// forma de llegar a un endpoint autenticado para desactivar el 2FA sin
// haber iniciado sesión antes). Un código de respaldo consumido en el
// login cuenta como si el TOTP hubiera pasado — no desactiva el 2FA por sí
// solo, solo abre una sesión para poder reconfigurarlo.
//
// Formato XXXX-XXXX (8 hex, mayúsculas) — cabe en el mismo campo `totp` del
// login (loginSchema.totp: max 10). Se guardan como hash SHA-256, nunca en
// texto plano; el texto plano solo se devuelve una vez, al generarlos.

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  });
}

function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}

/** Verifica un código contra la lista de hashes guardados; devuelve el índice
 * consumido (para que el caller lo remueva y persista) o -1 si no coincide. */
export function findBackupCodeIndex(hashes: string[], code: string): number {
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(normalizeBackupCode(code))) return -1;
  const target = Buffer.from(hashBackupCode(code));
  return hashes.findIndex(stored => {
    try { return crypto.timingSafeEqual(Buffer.from(stored), target); } catch { return false; }
  });
}
