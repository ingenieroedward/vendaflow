import { issueImpersonationCode, consumeImpersonationCode, IMPERSONATION_CODE_TTL_MS } from '../impersonationCodes';

describe('códigos de impersonación', () => {
  it('se canjean una sola vez', () => {
    const code = issueImpersonationCode(5, 2);
    expect(consumeImpersonationCode(code)).toEqual({ userId: 5, tenantId: 2 });
    expect(consumeImpersonationCode(code)).toBeNull();
  });
  it('vencen a los 2 minutos', () => {
    const t0 = 1_000_000;
    const code = issueImpersonationCode(5, 2, t0);
    expect(consumeImpersonationCode(code, t0 + IMPERSONATION_CODE_TTL_MS + 1)).toBeNull();
  });
  it('sirven dentro de la ventana', () => {
    const t0 = 2_000_000;
    const code = issueImpersonationCode(9, 3, t0);
    expect(consumeImpersonationCode(code, t0 + IMPERSONATION_CODE_TTL_MS - 1)).toEqual({ userId: 9, tenantId: 3 });
  });
  it('son opacos, largos y distintos', () => {
    const a = issueImpersonationCode(1, 1); const b = issueImpersonationCode(1, 1);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toContain('.'); // no es un JWT
  });
  it('entradas basura → null', () => {
    expect(consumeImpersonationCode('no-existe')).toBeNull();
    expect(consumeImpersonationCode('x'.repeat(500))).toBeNull();
    expect(consumeImpersonationCode(undefined as unknown as string)).toBeNull();
  });
});
