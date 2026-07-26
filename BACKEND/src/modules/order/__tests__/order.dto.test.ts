import { createOrderSchema, updateOrderSchema } from '../order.dto';

const baseItems = [{ productId: 1, quantity: 2, taxRate: 0, unitPrice: 1000 }];

describe('createOrderSchema', () => {
  it('acepta una orden de contado mínima y aplica defaults', () => {
    const parsed = createOrderSchema.parse({ customerId: 1, items: baseItems });
    expect(parsed.status).toBe('pending');
    expect(parsed.paymentType).toBe('cash');
  });

  it('rechaza órdenes sin items', () => {
    const result = createOrderSchema.safeParse({ customerId: 1, items: [] });
    expect(result.success).toBe(false);
  });

  it('exige taxRate en los items', () => {
    const result = createOrderSchema.safeParse({
      customerId: 1,
      items: [{ productId: 1, quantity: 1, unitPrice: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza crédito sin fecha límite de pago', () => {
    const result = createOrderSchema.safeParse({
      customerId: 1,
      items: baseItems,
      paymentType: 'credit',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.path).toContain('paymentDueDate');
    }
  });

  it('acepta crédito con fecha límite y días de recordatorio', () => {
    const parsed = createOrderSchema.parse({
      customerId: 1,
      items: baseItems,
      paymentType: 'credit',
      paymentDueDate: '2026-08-15',
      reminderDays: 5,
    });
    expect(parsed.paymentDueDate).toBe('2026-08-15');
    expect(parsed.reminderDays).toBe(5);
  });

  it('rechaza fechas con formato inválido', () => {
    const result = createOrderSchema.safeParse({
      customerId: 1,
      items: baseItems,
      paymentType: 'credit',
      paymentDueDate: '15/08/2026',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza reminderDays fuera de rango (0-90)', () => {
    const result = createOrderSchema.safeParse({
      customerId: 1,
      items: baseItems,
      paymentType: 'credit',
      paymentDueDate: '2026-08-15',
      reminderDays: 120,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateOrderSchema', () => {
  it('acepta actualización parcial de solo estado', () => {
    const parsed = updateOrderSchema.parse({ status: 'completed' });
    expect(parsed.status).toBe('completed');
  });

  it('acepta cambiar el pago a crédito', () => {
    const parsed = updateOrderSchema.parse({
      paymentType: 'credit',
      paymentDueDate: '2026-09-01',
      reminderDays: 3,
    });
    expect(parsed.paymentType).toBe('credit');
  });

  it('rechaza estados inválidos', () => {
    const result = updateOrderSchema.safeParse({ status: 'enviada' });
    expect(result.success).toBe(false);
  });
});
