import { createQuoteSchema, updateQuoteSchema } from '../quote.dto';

const baseItems = [{ productId: 1, quantity: 2, taxRate: 0, unitPrice: 1000 }];

describe('createQuoteSchema', () => {
  it('acepta una cotización mínima y aplica defaults', () => {
    const parsed = createQuoteSchema.parse({ customerId: 1, items: baseItems });
    expect(parsed.status).toBe('draft');
  });

  it('rechaza cotizaciones sin items', () => {
    const result = createQuoteSchema.safeParse({ customerId: 1, items: [] });
    expect(result.success).toBe(false);
  });

  it('exige taxRate en los items', () => {
    const result = createQuoteSchema.safeParse({
      customerId: 1,
      items: [{ productId: 1, quantity: 1, unitPrice: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it('acepta un estado y una fecha de validez explícitos', () => {
    const parsed = createQuoteSchema.parse({
      customerId: 1,
      items: baseItems,
      status: 'sent',
      validUntil: '2026-12-31',
    });
    expect(parsed.status).toBe('sent');
    expect(parsed.validUntil).toBeInstanceOf(Date);
  });

  it('acepta clientRef para idempotencia offline-first', () => {
    const parsed = createQuoteSchema.parse({
      customerId: 1,
      items: baseItems,
      clientRef: 'local-123',
    });
    expect(parsed.clientRef).toBe('local-123');
  });
});

describe('updateQuoteSchema', () => {
  it('permite actualizar solo el status', () => {
    const parsed = updateQuoteSchema.parse({ status: 'accepted' });
    expect(parsed.status).toBe('accepted');
    expect(parsed.items).toBeUndefined();
  });

  it('rechaza un status fuera del enum', () => {
    const result = updateQuoteSchema.safeParse({ status: 'bogus' });
    expect(result.success).toBe(false);
  });
});
