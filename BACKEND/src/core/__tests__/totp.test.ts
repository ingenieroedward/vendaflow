import { generateTotpSecret, verifyTotp, totpUri } from '../totp';

// Vector de prueba RFC 6238 (Apéndice B usa SHA-1 con secreto "12345678901234567890")
// En base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
const RFC_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('genera secretos base32 de 32 caracteres', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s); // aleatorio
  });

  it('verifica los vectores RFC 6238 (SHA-1, 6 dígitos truncados de 8)', () => {
    // RFC: T=59s → código de 8 dígitos 94287082 → últimos 6: 287082
    expect(verifyTotp(RFC_SECRET_B32, '287082', 59_000)).toBe(true);
    // T=1111111109 → 07081804 → 081804
    expect(verifyTotp(RFC_SECRET_B32, '081804', 1_111_111_109_000)).toBe(true);
  });

  it('rechaza códigos incorrectos y malformados', () => {
    expect(verifyTotp(RFC_SECRET_B32, '000000', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, 'abc123', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '28708', 59_000)).toBe(false); // 5 dígitos
  });

  it('acepta el código del período anterior (ventana ±30s) pero no dos atrás', () => {
    // 287082 es el código del counter=1 (T=30-59s) según el RFC
    expect(verifyTotp(RFC_SECRET_B32, '287082', 89_000)).toBe(true);   // counter=2, ventana incluye 1
    expect(verifyTotp(RFC_SECRET_B32, '287082', 149_000)).toBe(false); // counter=4, ya fuera de ventana
  });

  it('acepta código con espacios (como lo pegan los usuarios)', () => {
    expect(verifyTotp(RFC_SECRET_B32, '287 082', 59_000)).toBe(true);
  });

  it('arma la URI otpauth correctamente', () => {
    const uri = totpUri('ABC234', 'edward');
    expect(uri).toContain('otpauth://totp/Merco:edward');
    expect(uri).toContain('secret=ABC234');
  });
});
