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

// Datos fiscales del emisor (Merco/Edwsystem) — persona natural, sin registro
// mercantil propio de "Merco" como marca. Fijo acá (no hay tabla de datos de
// la plataforma en sí, a diferencia de tenants.nit/address/city por tenant).
const ISSUER_NAME = 'Edwsystem (Edward Díaz)';
const ISSUER_NIT = '1003062747';

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

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // Datos del tenant que paga (razón social del recibo) — mismos campos que
  // usa cada tenant en sus propios PDF de venta (Fase A, ago 2026).
  const buyerLines = [
    tenant?.nit ? `NIT: ${esc(tenant.nit)}` : null,
    tenant?.address ? esc(tenant.address) : null,
    tenant?.city ? esc(tenant.city) : null,
    tenant?.contactPhone ? `Tel: ${esc(tenant.contactPhone)}` : null,
  ].filter((l): l is string => !!l);

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Recibo ${payment.receiptNumber} — Merco</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #f3f4f6; color: #111827; padding: 24px 16px; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
  .head { background: #ffffff; border-bottom: 2px solid #a9c6e8; padding: 20px 28px; display: flex; justify-content: space-between; align-items: flex-start; }
  .head img { height: 36px; margin-bottom: 4px; }
  .head .brand-sub { font-size: 11px; color: #6b7280; }
  .head .brand-nit { font-size: 10.5px; color: #9ca3af; margin-top: 1px; }
  .badge { background: #10b981; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; letter-spacing: .05em; white-space: nowrap; }
  .body { padding: 24px 28px 28px; }
  .num { font-size: 22px; font-weight: 800; margin-bottom: 2px; color: #3b6ea5; }
  .sub { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
  .boxes { display: flex; gap: 12px; margin-bottom: 20px; }
  .box { flex: 1; border: 1px solid #a9c6e8; border-radius: 8px; overflow: hidden; }
  .box-label { background: #eef5fc; color: #3b6ea5; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 6px 10px; }
  .box-body { padding: 10px; font-size: 12.5px; line-height: 1.5; }
  .box-body .name { font-weight: 700; font-size: 13.5px; margin-bottom: 2px; }
  .box-body .line { color: #4b5563; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 9px 0; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; }
  td:last-child { text-align: right; font-weight: 600; }
  .total-box { margin-top: 16px; background: #eef5fc; border: 1px solid #a9c6e8; border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
  .total-box .label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #3b6ea5; }
  .total-box .amount { font-size: 20px; font-weight: 800; color: #111827; }
  .foot { padding: 14px 28px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px; }
  .print { display: block; margin: 20px auto 0; padding: 10px 24px; background: #2563eb; color: #fff; border: 0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .card { border: none; } .print { display: none; } }
  @media (max-width: 420px) { .boxes { flex-direction: column; } }
</style></head><body>
<div class="card">
  <div class="head">
    <div>
      <img src="https://merco.edwsystem.com/brand/logo-full.png" alt="Merco System">
      <div class="brand-sub">merco.edwsystem.com</div>
      <div class="brand-nit">${esc(ISSUER_NAME)} · NIT ${esc(ISSUER_NIT)}</div>
    </div>
    <span class="badge">PAGADO</span>
  </div>
  <div class="body">
    <p class="num">Recibo ${payment.receiptNumber}</p>
    <p class="sub">Comprobante de pago — plan ${esc(payment.plan)}</p>

    <div class="boxes">
      <div class="box">
        <div class="box-label">Recibido de</div>
        <div class="box-body">
          <div class="name">${esc(tenant?.name ?? '')}</div>
          ${buyerLines.map(l => `<div class="line">${l}</div>`).join('') || '<div class="line">—</div>'}
        </div>
      </div>
      <div class="box">
        <div class="box-label">Detalles del pago</div>
        <div class="box-body">
          <div class="line">Fecha: ${fmtDate(payment.paidAt ?? payment.decidedAt)}</div>
          <div class="line">Período: ${payment.periodStart ? `${fmtDate(payment.periodStart)} — ${fmtDate(payment.periodEnd)}` : `${payment.months} mes${payment.months === 1 ? '' : 'es'}`}</div>
          <div class="line">Método: ${METHOD_ES[payment.method ?? ''] ?? payment.method ?? 'Transferencia'}</div>
          ${payment.reference ? `<div class="line">Ref: ${esc(String(payment.reference))}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="total-box">
      <span class="label">Total pagado</span>
      <span class="amount">${fmtCop(Number(payment.amount))}</span>
    </div>
  </div>
  <div class="foot">Merco · merco.edwsystem.com · Recibo generado automáticamente — válido como soporte de pago. Este documento no constituye una factura electrónica.</div>
</div>
<button class="print" onclick="window.print()">Imprimir / Guardar PDF</button>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(html);
}));

export default router;
