jest.mock('../cash-session.model', () => ({
  CashSession: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
}));
jest.mock('@/modules/user/user.model', () => ({ User: {} }));

import { PosService } from '../pos.service';
import { CashSession } from '../cash-session.model';

const mockFindOne = CashSession.findOne as jest.Mock;
const mockCreate = CashSession.create as jest.Mock;
const service = new PosService();

beforeEach(() => {
  mockFindOne.mockReset();
  mockCreate.mockReset();
});

describe('openSession', () => {
  it('abre caja cuando no hay ninguna abierta', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ id: 1, status: 'open', openingAmount: 50000 });

    const session = await service.openSession(1, 10, { openingAmount: 50000 });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 1, userId: 10, openingAmount: 50000, status: 'open',
    }));
    expect(session.status).toBe('open');
  });

  it('rechaza abrir una segunda caja mientras hay una abierta', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 1, status: 'open' });
    await expect(service.openSession(1, 10, { openingAmount: 50000 }))
      .rejects.toThrow(/ya hay una caja abierta/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rechaza monto inicial negativo', async () => {
    await expect(service.openSession(1, 10, { openingAmount: -100 })).rejects.toThrow();
    expect(mockFindOne).not.toHaveBeenCalled();
  });
});

describe('closeSession', () => {
  it('calcula la diferencia contra la base inicial (Fase 1, sin ventas aún)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: null, update });

    await service.closeSession(1, 1, { countedCash: 52000 });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      countedCash: 52000, expectedCash: 50000, difference: 2000, status: 'closed',
    }));
  });

  it('detecta faltante (diferencia negativa)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: null, update });

    await service.closeSession(1, 1, { countedCash: 48000 });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ difference: -2000 }));
  });

  it('falla si no hay caja abierta con ese id', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    await expect(service.closeSession(1, 999, { countedCash: 1000 })).rejects.toThrow();
  });

  it('rechaza conteo negativo', async () => {
    await expect(service.closeSession(1, 1, { countedCash: -5 })).rejects.toThrow();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('acumula notas sin borrar las de apertura', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: 'apertura normal', update });

    await service.closeSession(1, 1, { countedCash: 50000, notes: 'cierre sin novedad' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      notes: 'apertura normal | cierre sin novedad',
    }));
  });
});
