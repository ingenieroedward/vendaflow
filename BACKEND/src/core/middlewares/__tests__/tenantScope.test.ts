import { Response } from 'express';

jest.mock('@/modules/tenant/tenant.model', () => ({
  Tenant: { findByPk: jest.fn() },
}));

import { tenantScope } from '../tenantScope';
import { Tenant } from '@/modules/tenant/tenant.model';
import { ForbiddenError } from '../../errors/AppError';

const mockFindByPk = Tenant.findByPk as jest.Mock;

const makeReq = (user: { id: number; role: string; tenantId: number } | undefined) =>
  ({ user } as never);
const res = {} as Response;

// El middleware cachea el estado por tenantId 60s — usar ids distintos por test
let nextTenantId = 1000;
const freshTenantId = () => ++nextTenantId;

describe('tenantScope', () => {
  beforeEach(() => mockFindByPk.mockReset());

  it('rechaza peticiones sin usuario autenticado', async () => {
    const next = jest.fn();
    await tenantScope(makeReq(undefined), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('deja pasar al superadmin sin consultar el tenant', async () => {
    const next = jest.fn();
    await tenantScope(makeReq({ id: 1, role: 'superadmin', tenantId: freshTenantId() }), res, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockFindByPk).not.toHaveBeenCalled();
  });

  it('deja pasar a usuarios de tenants activos', async () => {
    mockFindByPk.mockResolvedValue({ isActive: true });
    const next = jest.fn();
    await tenantScope(makeReq({ id: 2, role: 'admin', tenantId: freshTenantId() }), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('bloquea a usuarios de tenants suspendidos aunque su JWT sea válido', async () => {
    mockFindByPk.mockResolvedValue({ isActive: false });
    const next = jest.fn();
    await tenantScope(makeReq({ id: 3, role: 'seller', tenantId: freshTenantId() }), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('bloquea si el tenant no existe (eliminado)', async () => {
    mockFindByPk.mockResolvedValue(null);
    const next = jest.fn();
    await tenantScope(makeReq({ id: 4, role: 'buyer', tenantId: freshTenantId() }), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('cachea el estado: la segunda petición del mismo tenant no consulta la DB', async () => {
    const tenantId = freshTenantId();
    mockFindByPk.mockResolvedValue({ isActive: true });

    await tenantScope(makeReq({ id: 5, role: 'admin', tenantId }), res, jest.fn());
    await tenantScope(makeReq({ id: 6, role: 'seller', tenantId }), res, jest.fn());

    expect(mockFindByPk).toHaveBeenCalledTimes(1);
  });
});
