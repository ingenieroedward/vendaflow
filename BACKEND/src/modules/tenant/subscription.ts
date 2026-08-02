// Lógica pura del ciclo de suscripción (sin BD — testeable)

/** Suma meses con clamp de fin de mes (31 ene + 1 mes = 28/29 feb, no 3 mar) */
export function addMonthsClamped(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

function toDay(value: string | Date): Date {
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Período que cubre un pago de N meses:
 * - Si el tenant sigue vigente (paidUntil >= hoy), el pago extiende desde
 *   paidUntil — pagar antes de tiempo no regala días.
 * - Si está vencido o nunca ha pagado, el período arranca hoy — no se cobra
 *   el hueco (pragmático para cobranza manual).
 */
export function computePaymentPeriod(
  paidUntil: string | Date | null,
  months: number,
  today: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const t = toDay(today);
  let base = t;
  if (paidUntil) {
    const pu = toDay(paidUntil);
    if (pu >= t) base = pu;
  }
  return { periodStart: new Date(base), periodEnd: addMonthsClamped(base, months) };
}

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
