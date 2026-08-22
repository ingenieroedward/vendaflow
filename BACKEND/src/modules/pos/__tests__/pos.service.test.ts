jest.mock('../cash-session.model', () => ({
  CashSession: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
}));
jest.mock('../pos-sale-payment.model', () => ({
  PosSalePayment: { findAll: jest.fn(), bulkCreate: jest.fn() },
}));
jest.mock('@/modules/user/user.model', () => ({ User: {} }));
jest.mock('../../customer/customer.model', () => ({ Customer: { findOrCreate: jest.fn(), findOne: jest.fn() } }));
const mockCreateOrder = jest.fn();
jest.mock('../../order/order.service', () => ({
  OrderService: jest.fn().mockImplementation(() => ({ createOrder: mockCreateOrder })),
}));

import { PosService } from '../pos.service';
import { CashSession } from '../cash-session.model';
import { PosSalePayment } from '../pos-sale-payment.model';
import { Customer } from '../../customer/customer.model';
// Sin mockear: es el schema real que createOrder() vuelve a correr internamente
// sobre el payload que arma pos.service.ts — createOrder() está mockeado arriba,
// así que sin esto una regresión de "envía null donde el DTO espera undefined"
// pasaría los tests aunque rompa en producción (fue justo lo que ocurrió).
import { createOrderSchema } from '../../order/order.dto';

const mockFindOne = CashSession.findOne as jest.Mock;
const mockCreate = CashSession.create as jest.Mock;
const mockPaymentsFindAll = PosSalePayment.findAll as jest.Mock;
const mockPaymentsBulkCreate = PosSalePayment.bulkCreate as jest.Mock;
const mockCustomerFindOrCreate = Customer.findOrCreate as jest.Mock;
const mockCustomerFindOne = Customer.findOne as jest.Mock;
const service = new PosService();

beforeEach(() => {
  mockFindOne.mockReset();
  mockCreate.mockReset();
  mockPaymentsFindAll.mockReset().mockResolvedValue([]); // sin ventas previas por defecto
  mockPaymentsBulkCreate.mockReset().mockResolvedValue(undefined);
  mockCustomerFindOrCreate.mockReset();
  mockCustomerFindOne.mockReset();
  mockCreateOrder.mockReset();
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
  it('sin ventas del turno, expectedCash es solo la base inicial', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const session = { id: 1, openingAmount: 50000, notes: null, update, toJSON: () => ({ id: 1 }) };
    mockFindOne.mockResolvedValueOnce(session);

    const result = await service.closeSession(1, 1, { countedCash: 52000 });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      countedCash: 52000, expectedCash: 50000, difference: 2000, status: 'closed',
    }));
    expect(result.salesByMethod.total).toBe(0);
  });

  it('suma las ventas en efectivo del turno a expectedCash (tarjeta no cuenta)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: null, update, toJSON: () => ({ id: 1 }) });
    mockPaymentsFindAll.mockResolvedValueOnce([
      { method: 'cash', amount: 30000 },
      { method: 'card', amount: 20000 }, // no debe sumar al efectivo esperado
      { method: 'cash', amount: 5000 },
    ]);

    const result = await service.closeSession(1, 1, { countedCash: 85000 });

    // esperado = 50000 base + 30000 + 5000 efectivo = 85000
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ expectedCash: 85000, difference: 0 }));
    expect(result.salesByMethod).toEqual({ cash: 35000, card: 20000, transfer: 0, other: 0, total: 55000 });
  });

  it('detecta faltante (diferencia negativa)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: null, update, toJSON: () => ({ id: 1 }) });

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
    mockFindOne.mockResolvedValueOnce({ id: 1, openingAmount: 50000, notes: 'apertura normal', update, toJSON: () => ({ id: 1 }) });

    await service.closeSession(1, 1, { countedCash: 50000, notes: 'cierre sin novedad' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      notes: 'apertura normal | cierre sin novedad',
    }));
  });
});

describe('sale', () => {
  // 2 * 5000 * 1.19 (IVA 19%) = 11900
  const items = [{ productId: 1, quantity: 2, unitPrice: 5000, taxRate: 19 }];

  it('rechaza vender sin caja abierta', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    await expect(service.sale(1, 10, { items, payments: [{ method: 'cash', amount: 11900 }] }))
      .rejects.toThrow(/abre la caja/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('rechaza si los pagos no cuadran con el total', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    await expect(service.sale(1, 10, { items, payments: [{ method: 'cash', amount: 10000 }] }))
      .rejects.toThrow(/no cuadran/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('sin customerId usa (o crea) el cliente "Consumidor final" del tenant', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOrCreate.mockResolvedValueOnce([{ id: 99, name: 'Consumidor final' }, true]);
    mockCreateOrder.mockResolvedValueOnce({ id: 1, orderNumber: 'ORD-0001' });

    await service.sale(1, 10, { items, payments: [{ method: 'cash', amount: 11900 }] });

    expect(mockCustomerFindOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 1, name: 'Consumidor final' },
    }));
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 99, source: 'pos', cashSessionId: 5,
        paymentType: 'cash', status: 'completed',
      }),
      10, 1,
    );
  });

  it('con customerId explícito, valida que pertenezca al tenant', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOne.mockResolvedValueOnce(null);

    await expect(service.sale(1, 10, { customerId: 42, items, payments: [{ method: 'cash', amount: 11900 }] }))
      .rejects.toThrow();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('con customerId válido, lo usa directamente (no crea Consumidor final)', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOne.mockResolvedValueOnce({ id: 42, tenantId: 1 });
    mockCreateOrder.mockResolvedValueOnce({ id: 2, orderNumber: 'ORD-0002' });

    await service.sale(1, 10, { customerId: 42, items, payments: [{ method: 'cash', amount: 11900 }] });

    expect(mockCustomerFindOrCreate).not.toHaveBeenCalled();
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ customerId: 42 }), 10, 1);
  });

  it('pago mixto (efectivo + tarjeta) que suma exacto al total', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOrCreate.mockResolvedValueOnce([{ id: 99 }, true]);
    mockCreateOrder.mockResolvedValueOnce({ id: 3, orderNumber: 'ORD-0003' });

    const result = await service.sale(1, 10, {
      items, payments: [{ method: 'cash', amount: 5000 }, { method: 'card', amount: 6900 }],
    });

    // undefined, no null — createOrderSchema.changeGiven es z.number().optional()
    // y rechaza null explícito (bug real corregido: rompía cualquier venta sin
    // "efectivo recibido" diligenciado, ver también el test de más abajo)
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ changeGiven: undefined }), 10, 1);
    expect(mockPaymentsBulkCreate).toHaveBeenCalledWith([
      { tenantId: 1, orderId: 3, cashSessionId: 5, method: 'cash', amount: 5000 },
      { tenantId: 1, orderId: 3, cashSessionId: 5, method: 'card', amount: 6900 },
    ]);
    expect(result.payments).toHaveLength(2);
  });

  it('calcula el vuelto cuando el efectivo recibido supera lo cobrado en efectivo', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOrCreate.mockResolvedValueOnce([{ id: 99 }, true]);
    mockCreateOrder.mockResolvedValueOnce({ id: 4, orderNumber: 'ORD-0004' });

    const result = await service.sale(1, 10, {
      items, payments: [{ method: 'cash', amount: 11900 }], cashReceived: 20000,
    });

    expect(result.changeGiven).toBe(8100);
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ changeGiven: 8100 }), 10, 1);
  });

  it('rechaza si el efectivo recibido es menor a lo que se paga en efectivo', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    await expect(service.sale(1, 10, {
      items, payments: [{ method: 'cash', amount: 11900 }], cashReceived: 5000,
    })).rejects.toThrow(/menor al monto/i);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('no calcula vuelto si no se informa cashReceived', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOrCreate.mockResolvedValueOnce([{ id: 99 }, true]);
    mockCreateOrder.mockResolvedValueOnce({ id: 6, orderNumber: 'ORD-0006' });

    const result = await service.sale(1, 10, { items, payments: [{ method: 'cash', amount: 11900 }] });

    expect(result.changeGiven).toBeNull();
  });

  it('regresión: venta sin línea de efectivo (ej. solo transferencia) produce un payload válido para createOrder', async () => {
    mockFindOne.mockResolvedValueOnce({ id: 5, status: 'open' });
    mockCustomerFindOrCreate.mockResolvedValueOnce([{ id: 99 }, true]);
    mockCreateOrder.mockResolvedValueOnce({ id: 7, orderNumber: 'ORD-0007' });

    await service.sale(1, 10, { items, payments: [{ method: 'transfer', amount: 11900 }] });

    // createOrder() está mockeado, así que corremos el schema real a mano
    // sobre el payload exacto que le llegaría — bug real que esto reproduce:
    // pos.service.ts pasaba `changeGiven: null`, y createOrderSchema (z.number()
    // .optional()) rechaza null explícito con "Expected number, received null",
    // rompiendo el cobro en producción para cualquier venta sin línea 'cash'.
    const payloadSent = mockCreateOrder.mock.calls[0][0];
    const parsed = createOrderSchema.safeParse(payloadSent);
    expect(parsed.success).toBe(true);
  });
});
