import { accountKey, lockedMinutesLeft, recordFailure, recordSuccess, MAX_FAILURES, WINDOW_MS, LOCK_MS } from '../loginThrottle';

describe('bloqueo de cuenta por intentos fallidos', () => {
  const t0 = 10_000_000;
  it('bloquea al llegar al máximo dentro de la ventana', () => {
    const k = accountKey('alfa', 'vend1');
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(k, t0 + i);
    expect(lockedMinutesLeft(k, t0 + 100)).toBe(0);
    recordFailure(k, t0 + 200);
    expect(lockedMinutesLeft(k, t0 + 200)).toBe(15);
  });
  it('se desbloquea solo al pasar el tiempo', () => {
    const k = accountKey('alfa', 'vend2');
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure(k, t0);
    expect(lockedMinutesLeft(k, t0 + LOCK_MS - 1)).toBeGreaterThan(0);
    expect(lockedMinutesLeft(k, t0 + LOCK_MS)).toBe(0);
  });
  it('fallos espaciados fuera de la ventana no acumulan', () => {
    const k = accountKey('alfa', 'vend3');
    for (let i = 0; i < MAX_FAILURES * 2; i++) recordFailure(k, t0 + i * (WINDOW_MS / 5 + 1));
    expect(lockedMinutesLeft(k, t0 + MAX_FAILURES * 2 * (WINDOW_MS / 5 + 1))).toBe(0);
  });
  it('un login correcto reinicia el contador', () => {
    const k = accountKey('alfa', 'vend4');
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(k, t0);
    recordSuccess(k);
    recordFailure(k, t0);
    expect(lockedMinutesLeft(k, t0)).toBe(0);
  });
  it('la llave separa tenants y no distingue mayúsculas/espacios', () => {
    expect(accountKey('ALFA', ' Vend ')).toBe(accountKey('alfa', 'vend'));
    expect(accountKey('alfa', 'vend')).not.toBe(accountKey('beta', 'vend'));
  });
});
