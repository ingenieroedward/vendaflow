import nodemailer from 'nodemailer';
import logger from '@/core/logger';

// Canal de email de respaldo (los push se pierden si el usuario nunca los
// aceptó — normal en B2B). Se activa solo si SMTP_HOST está configurado en
// el entorno; sin config, todas las llamadas son no-ops silenciosos.
const host = process.env['SMTP_HOST'];
const port = Number(process.env['SMTP_PORT'] ?? 587);
const user = process.env['SMTP_USER'];
const pass = process.env['SMTP_PASS'];
const from = process.env['SMTP_FROM'] ?? user ?? 'Merco <no-reply@merco.edwsystem.com>';

export const emailEnabled = Boolean(host && user && pass);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  : null;

/** Plantilla mínima con la identidad de Merco (inline styles — clientes de correo) */
export function renderEmail(title: string, lines: string[], cta?: { label: string; url: string }): string {
  const body = lines.map(l => `<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">${l}</p>`).join('');
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:8px;padding:10px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0f172a;padding:16px 24px;">
      <span style="color:#ffffff;font-size:16px;font-weight:700;">Merco</span>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px;color:#111827;font-size:18px;">${title}</h1>
      ${body}
      ${button}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">Merco · merco.edwsystem.com · Este es un mensaje automático.</p>
    </div>
  </div></body></html>`;
}

/** Envío tolerante a fallos: nunca rompe el flujo que lo llama */
export async function sendEmail(to: string | null | undefined, subject: string, html: string): Promise<boolean> {
  if (!transporter || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  try {
    await transporter.sendMail({ from, to, subject, html });
    logger.info(`[email] Enviado a ${to}: ${subject}`);
    return true;
  } catch (err) {
    logger.error(`[email] Error enviando a ${to}:`, err);
    return false;
  }
}
