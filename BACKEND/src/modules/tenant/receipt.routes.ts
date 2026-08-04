import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '@/config';
import { asyncHandler } from '@/core/middlewares/asyncHandler';

const router = Router();

// Token firmado por recibo: el link se puede compartir con el cliente sin
// exponer nada más (solo abre ESTE recibo; imposible enumerar otros)
export function receiptToken(paymentId: number): string {
  return crypto.createHmac('sha256', config.jwt.secret).update(`receipt:${paymentId}`).digest('hex').slice(0, 32);
}

export function receiptUrl(paymentId: number): string {
  return `https://api.merco.edwsystem.com/api/receipts/${paymentId}?t=${receiptToken(paymentId)}`;
}

const fmtCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')} COP`;
const fmtDate = (d: string | Date | null) =>
  d ? new Date(typeof d === 'string' ? `${String(d).slice(0, 10)}T00:00:00` : d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const METHOD_ES: Record<string, string> = { breb: 'Bre-B', transferencia: 'Transferencia', efectivo: 'Efectivo', otro: 'Otro' };

// GET /api/receipts/:id?t=<token> — página HTML imprimible (público con token)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const token = String(req.query['t'] ?? '');
  if (!Number.isInteger(id) || !token || !crypto.timingSafeEqual(
    Buffer.from(receiptToken(id).padEnd(64)), Buffer.from(token.slice(0, 64).padEnd(64)),
  )) {
    res.status(404).send('Recibo no encontrado');
    return;
  }

  const { PlanPayment } = await import('./plan-payment.model');
  const { Tenant } = await import('./tenant.model');
  const payment = await PlanPayment.findByPk(id);
  if (!payment || payment.status !== 'approved') {
    res.status(404).send('Recibo no encontrado');
    return;
  }
  const tenant = await Tenant.findByPk(payment.tenantId);

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Recibo ${payment.receiptNumber} — Merco</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #f3f4f6; color: #111827; padding: 24px 16px; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
  .head { background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; }
  .head img { height: 40px; }
  .badge { background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; letter-spacing: .05em; }
  .body { padding: 28px; }
  .num { font-size: 24px; font-weight: 800; margin-bottom: 2px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 9px 0; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; }
  td:last-child { text-align: right; font-weight: 600; }
  .total td { border-bottom: none; padding-top: 14px; font-size: 18px; }
  .total td:last-child { font-weight: 800; }
  .foot { padding: 14px 28px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px; }
  .print { display: block; margin: 20px auto 0; padding: 10px 24px; background: #2563eb; color: #fff; border: 0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .card { border: none; } .print { display: none; } }
</style></head><body>
<div class="card">
  <div class="head"><img src="https://merco.edwsystem.com/brand/logo-full.png" alt="Merco System"><span class="badge">PAGADO</span></div>
  <div class="body">
    <p class="num">Recibo ${payment.receiptNumber}</p>
    <p class="sub">${tenant?.name ?? ''}</p>
    <table>
      <tr><td>Fecha del pago</td><td>${fmtDate(payment.paidAt ?? payment.decidedAt)}</td></tr>
      <tr><td>Plan</td><td style="text-transform:capitalize">${payment.plan}</td></tr>
      <tr><td>Período cubierto</td><td>${payment.periodStart ? `${fmtDate(payment.periodStart)} — ${fmtDate(payment.periodEnd)}` : `${payment.months} mes${payment.months === 1 ? '' : 'es'}`}</td></tr>
      <tr><td>Método</td><td>${METHOD_ES[payment.method ?? ''] ?? payment.method ?? 'Transferencia'}</td></tr>
      ${payment.reference ? `<tr><td>Referencia</td><td>${String(payment.reference).replace(/</g, '&lt;')}</td></tr>` : ''}
      <tr class="total"><td>Total pagado</td><td>${fmtCop(Number(payment.amount))}</td></tr>
    </table>
  </div>
  <div class="foot">Merco · merco.edwsystem.com · Recibo generado automáticamente — válido como soporte de pago.</div>
</div>
<button class="print" onclick="window.print()">Imprimir / Guardar PDF</button>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(html);
}));

export default router;
