import { Op } from 'sequelize';
import { Tenant } from '@/modules/tenant/tenant.model';
import { User } from '@/modules/user/user.model';
import { Order } from '@/modules/order/order.model';
import { pushService } from '@/modules/push/push.service';
import { sendEmail, renderEmail } from '@/core/email';
import { scheduleDailyJob } from './dailyScheduler';

const fmtCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/**
 * Digest de los lunes para el superadmin: MRR, cobrado la semana pasada,
 * vencimientos de esta semana, morosos, trials y señales de churn
 * (tenants activos sin órdenes en 14 días) + cancelados listos para purga.
 */
export async function sendWeeklyDigest(): Promise<void> {
  if (new Date().getDay() !== 1) return; // solo lunes (el dedup diario permite chequear a diario)

  const { TenantService } = await import('@/modules/tenant/tenant.service');
  const finance = await new TenantService().getFinance();

  const { PlanPayment } = await import('@/modules/tenant/plan-payment.model');
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const collectedLastWeek = Number(await PlanPayment.sum('amount', {
    where: { status: 'approved', decidedAt: { [Op.gte]: weekAgo } },
  })) || 0;

  const trials = await Tenant.count({ where: { status: 'trial', slug: { [Op.ne]: 'demo' } } });

  // Señal de churn: activos sin órdenes en 14 días
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000);
  const activeTenants = await Tenant.findAll({
    where: { status: 'active', slug: { [Op.ne]: 'demo' } },
    attributes: ['id', 'name'],
    raw: true,
  });
  const inactive: string[] = [];
  for (const t of activeTenants) {
    const recent = await Order.count({ where: { tenantId: t.id, createdAt: { [Op.gte]: twoWeeksAgo } } });
    if (recent === 0) inactive.push(t.name);
  }

  // Cancelados con más de 90 días — elegibles para purga de datos
  const purgeReady = await Tenant.findAll({
    where: { status: 'cancelled', cancelledAt: { [Op.lt]: new Date(Date.now() - 90 * 86400_000) } },
    attributes: ['name'],
    raw: true,
  });

  const dueThisWeek = finance.upcoming.filter(u => (u.daysLeft ?? 99) <= 7);

  const lines = [
    `MRR: ${fmtCop(finance.mrr)} (${finance.activePaying} pagando)`,
    `Cobrado última semana: ${fmtCop(collectedLastWeek)}`,
    dueThisWeek.length
      ? `Vencen esta semana: ${dueThisWeek.map(u => `${u.name} (${u.paidUntil}, ${fmtCop(u.amount)})`).join(' · ')}`
      : 'Vencen esta semana: ninguno',
    finance.overdue.length
      ? `Morosos: ${finance.overdue.map(o => o.name).join(', ')} — ${fmtCop(finance.overdue.reduce((s, o) => s + o.amount, 0))} en riesgo`
      : 'Morosos: ninguno ✓',
    `Trials activos: ${trials}`,
    inactive.length ? `⚠ Sin actividad 14 días (riesgo de churn): ${inactive.join(', ')}` : 'Actividad: todos los tenants activos han vendido esta quincena ✓',
  ];
  if (finance.noPaidUntil.length) lines.push(`Sin fecha de pago registrada: ${finance.noPaidUntil.map(t => t.name).join(', ')}`);
  if (purgeReady.length) lines.push(`Cancelados +90 días (elegibles para purga): ${purgeReady.map(t => t.name).join(', ')}`);

  const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
  await pushService.notifyUsers(
    superadmins.map(u => u.id),
    'Resumen semanal de Merco',
    lines.slice(0, 4).join('\n'),
    { url: '/' },
  ).catch(() => {});

  const digestEmail = process.env['DIGEST_EMAIL'] ?? process.env['SMTP_USER'];
  await sendEmail(digestEmail, 'Resumen semanal — Merco', renderEmail('Resumen semanal', lines));
}

export function startWeeklyDigestJob(): void {
  scheduleDailyJob('weeklyDigest', sendWeeklyDigest);
}
