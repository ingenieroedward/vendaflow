jest.mock('@/modules/user/user.model', () => ({ User: { findByPk: jest.fn() } }));

import { isSessionValid, getSessionUser, invalidateSession } from '../sessionCache';
import { User } from '@/modules/user/user.model';
import type { JwtPayload } from '@/modules/auth/auth.dto';

const payload = (over: Partial<JwtPayload> = {}): JwtPayload =>
  ({ userId: 7, username: 'vend', role: 'seller', tenantId: 3, tv: 0, ...over });
const user = { role: 'seller' as const, tenantId: 3, tokenVersion: 0 };

describe('isSessionValid', () => {
  it('token vigente del mismo usuario → válido', () => {
    expect(isSessionValid(payload(), user)).toBe(true);
  });
  it('token emitido antes de v1.16.9 (sin tv) sigue válido mientras tokenVersion sea 0', () => {
    const legacy = payload(); delete legacy.tv;
    expect(isSessionValid(legacy, user)).toBe(true);
    expect(isSessionValid(legacy, { ...user, tokenVersion: 1 })).toBe(false);
  });
  it('usuario eliminado → inválido', () => {
    expect(isSessionValid(payload(), null)).toBe(false);
  });
  it('rol cambiado (degradado o ascendido) → inválido', () => {
    expect(isSessionValid(payload({ role: 'admin' }), user)).toBe(false);
  });
  it('contraseña cambiada (tokenVersion subió) → inválido', () => {
    expect(isSessionValid(payload({ tv: 0 }), { ...user, tokenVersion: 1 })).toBe(false);
    expect(isSessionValid(payload({ tv: 1 }), { ...user, tokenVersion: 1 })).toBe(true);
  });
  it('tenant distinto → inválido', () => {
    expect(isSessionValid(payload({ tenantId: 4 }), user)).toBe(false);
  });
});

describe('getSessionUser (caché)', () => {
  const findByPk = User.findByPk as jest.Mock;
  beforeEach(() => { findByPk.mockReset(); invalidateSession(7); });

  it('cachea la consulta y invalidateSession la fuerza de nuevo', async () => {
    findByPk.mockResolvedValue({ role: 'seller', tenantId: 3, tokenVersion: 0 });
    await getSessionUser(7); await getSessionUser(7);
    expect(findByPk).toHaveBeenCalledTimes(1);
    invalidateSession(7);
    findByPk.mockResolvedValue({ role: 'buyer', tenantId: 3, tokenVersion: 1 });
    expect(await getSessionUser(7)).toEqual({ role: 'buyer', tenantId: 3, tokenVersion: 1 });
    expect(findByPk).toHaveBeenCalledTimes(2);
  });
  it('usuario inexistente/eliminado → null', async () => {
    findByPk.mockResolvedValue(null);
    expect(await getSessionUser(7)).toBeNull();
  });
});
