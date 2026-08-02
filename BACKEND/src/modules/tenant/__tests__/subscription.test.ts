import { addMonthsClamped, computePaymentPeriod, toDateOnly } from '../subscription';

const d = (s: string) => new Date(`${s}T00:00:00`);

describe('addMonthsClamped', () => {
  it('suma meses normales', () => {
    expect(toDateOnly(addMonthsClamped(d('2026-08-02'), 1))).toBe('2026-09-02');
    expect(toDateOnly(addMonthsClamped(d('2026-08-02'), 6))).toBe('2027-02-02');
  });

  it('clamp de fin de mes: 31 ene + 1 mes = 28 feb', () => {
    expect(toDateOnly(addMonthsClamped(d('2026-01-31'), 1))).toBe('2026-02-28');
    expect(toDateOnly(addMonthsClamped(d('2024-01-31'), 1))).toBe('2024-02-29'); // bisiesto
    expect(toDateOnly(addMonthsClamped(d('2026-08-31'), 1))).toBe('2026-09-30');
  });
});

describe('computePaymentPeriod', () => {
  const today = d('2026-08-02');

  it('tenant nunca pagado: el período arranca hoy', () => {
    const { periodStart, periodEnd } = computePaymentPeriod(null, 1, today);
    expect(toDateOnly(periodStart)).toBe('2026-08-02');
    expect(toDateOnly(periodEnd)).toBe('2026-09-02');
  });

  it('tenant vigente: extiende desde paidUntil (pagar antes no regala días)', () => {
    const { periodStart, periodEnd } = computePaymentPeriod('2026-08-20', 1, today);
    expect(toDateOnly(periodStart)).toBe('2026-08-20');
    expect(toDateOnly(periodEnd)).toBe('2026-09-20');
  });

  it('tenant vencido: el nuevo período arranca hoy (no se cobra el hueco)', () => {
    const { periodStart, periodEnd } = computePaymentPeriod('2026-07-15', 1, today);
    expect(toDateOnly(periodStart)).toBe('2026-08-02');
    expect(toDateOnly(periodEnd)).toBe('2026-09-02');
  });

  it('pago de varios meses', () => {
    const { periodEnd } = computePaymentPeriod(null, 12, today);
    expect(toDateOnly(periodEnd)).toBe('2027-08-02');
  });

  it('acepta paidUntil como string DATEONLY de Sequelize', () => {
    const { periodEnd } = computePaymentPeriod('2026-08-10', 3, today);
    expect(toDateOnly(periodEnd)).toBe('2026-11-10');
  });
});
