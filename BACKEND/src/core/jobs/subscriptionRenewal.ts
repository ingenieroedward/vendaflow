import { Op } from 'sequelize';
import { Tenant } from '@/modules/tenant/tenant.model';
import { User } from '@/modules/user/user.model';
import { pushService } from '@/modules/push/push.service';
import { getPlanConfig } from '@/config/plans';
import { toDateOnly } from '@/modules/tenant/subscription';
import logger from '@/core/logger';
import { scheduleDailyJob } from './dailyScheduler';
import { sendEmail, renderEmail } from '@/core/email';

async function notifyTenantAdmins(tenantId: number, title: string, body: string): Promise<void> {
  const admins = await User.findAll({ where: { tenantId, role: 'admin' }, attributes: ['id'] });
  if (admins.length) await pushService.notifyUsers(admins.map(u => u.id), title, body, { url: '/settings' });
}

async function notifySuperadmins(title: string, body: string): Promise<void> {
  const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
  if (superadmins.length) await pushService.notifyUsers(superadmins.map(u => u.id), title, body, { url: '/' });
}

const fmtCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/**
 * Ciclo de renovación mensual (deriva todo de tenants.paidUntil):
 * 1. Por vencer (días restantes ∈ {warnDays, 1}): push al tenant con monto y llave Bre-B
 * 2. Vencido en gracia: push al tenant (día 1 y último) + consolidado diario al superadmin
 * 3. Gracia agotada: suspende (suspendedReason='nonpayment') — un pago registrado reactiva
 * Exentos: demo, tenants con paidUntil null (cortesía/legado) y estados no activos.
 */
export async function checkSubscriptionRenewal(): Promise<void> {
  const cfg = await getPlanConfig();
  const today = toDateOnly(new Date());
  const daysBetween = (a: string, b: string) =>
    Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400_000);

  const tenants = await Tenant.findAll({
    where: {
      status: 'active',
      plan: { [Op.ne]: 'trial' },
      slug: { [Op.ne]: 'demo' },
      paidUntil: { [Op.ne]: null },
    },
  });

  const overdueLines: string[] = [];

  for (const tenant of tenants) {
    const amount = Number(tenant.customPrice ?? cfg.prices[tenant.plan] ?? 0);
    const daysLeft = daysBetween(today, tenant.paidUntil!);

    try {
      if (daysLeft > 0) {
        // 1. Por vencer — solo en los hitos para no ametrallar a diario
        if (daysLeft === cfg.renewalWarnDays || daysLeft === 1) {
          const title = daysLeft === 1 ? 'Tu plan vence mañana' : `Tu plan vence en ${daysLeft} días`;
          const body = `Renueva tu plan ${tenant.plan} de ${tenant.name}: ${fmtCop(amount)} vía Bre-B a la llave ${cfg.brebKey} (${cfg.brebHolder}). Repórtalo en Configuración → Plan.`;
          await notifyTenantAdmins(tenant.id, title, body);
          await sendEmail(tenant.contactEmail, `${title} — Merco`, renderEmail(title, [
            `Hola${tenant.contactName ? ` ${tenant.contactName}` : ''}, el plan <b>${tenant.plan}</b> de <b>${tenant.name}</b> vence el <b>${tenant.paidUntil}</b>.`,
            `Valor a pagar: <b>${fmtCop(amount)}</b> vía Bre-B a la llave <b>${cfg.brebKey}</b> (${cfg.brebHolder}).`,
            'Cuando pagues, repórtalo desde la app en Configuración → Plan y te confirmamos el recibo.',
          ], { label: 'Ir a mi configuración', url: `https://${tenant.slug}.merco.edwsystem.com/settings` }));
        }
      } else {
        const daysOverdue = -daysLeft;
        if (daysOverdue <= cfg.graceDays) {
          // 2. En gracia
          overdueLines.push(`${tenant.name} — venció hace ${daysOverdue} día${daysOverdue === 1 ? '' : 's'}, ${fmtCop(amount)}`);
          if (daysOverdue === 1 || daysOverdue === cfg.graceDays) {
            const cutoff = toDateOnly(new Date(new Date(`${tenant.paidUntil}T00:00:00`).getTime() + (cfg.graceDays + 1) * 86400_000));
            const body = `El plan ${tenant.plan} de ${tenant.name} venció hace ${daysOverdue} día${daysOverdue === 1 ? '' : 's'}. Renueva por ${fmtCop(amount)} (Bre-B: ${cfg.brebKey}) antes del ${cutoff} para evitar la suspensión.`;
            await notifyTenantAdmins(tenant.id, 'Tu plan está vencido', body);
            await sendEmail(tenant.contactEmail, 'Tu plan está vencido — Merco', renderEmail('Tu plan está vencido', [
              `El plan <b>${tenant.plan}</b> de <b>${tenant.name}</b> venció el <b>${tenant.paidUntil}</b>.`,
              `Renueva por <b>${fmtCop(amount)}</b> vía Bre-B a la llave <b>${cfg.brebKey}</b> (${cfg.brebHolder}) antes del <b>${cutoff}</b> para evitar la suspensión del servicio.`,
            ], { label: 'Reportar mi pago', url: `https://${tenant.slug}.merco.edwsystem.com/settings` }));
          }
        } else {
          // 3. Corte
          await tenant.update({ status: 'suspended', suspendedReason: 'nonpayment' });
          logger.info(`[subscriptionRenewal] Tenant "${tenant.slug}" suspendido por no pago (venció ${tenant.paidUntil})`);
          await notifyTenantAdmins(
            tenant.id,
            'Cuenta suspendida por falta de pago',
            `El plan de ${tenant.name} venció hace ${daysOverdue} días y la cuenta fue suspendida. Al registrar tu pago se reactiva de inmediato.`,
          );
          await sendEmail(tenant.contactEmail, 'Cuenta suspendida por falta de pago — Merco', renderEmail('Cuenta suspendida', [
            `El plan de <b>${tenant.name}</b> venció hace ${daysOverdue} días y la cuenta fue suspendida.`,
            `Para reactivarla de inmediato, paga <b>${fmtCop(amount)}</b> vía Bre-B a la llave <b>${cfg.brebKey}</b> (${cfg.brebHolder}) y avísanos.`,
          ]));
          await notifySuperadmins('Tenant suspendido por no pago', `${tenant.name} (${tenant.slug}) — venció ${tenant.paidUntil}, ${fmtCop(amount)}/mes.`);
        }
      }
    } catch (err) {
      logger.error(`[subscriptionRenewal] Error con tenant ${tenant.slug}:`, err);
    }
  }

  if (overdueLines.length) {
    await notifySuperadmins(
      overdueLines.length === 1 ? 'Cobro pendiente' : `${overdueLines.length} cobros pendientes`,
      overdueLines.slice(0, 5).join('\n') + (overdueLines.length > 5 ? `\n…y ${overdueLines.length - 5} más` : ''),
    ).catch(() => {});
  }
}

export function startSubscriptionRenewalJob(): void {
  scheduleDailyJob('subscriptionRenewal', checkSubscriptionRenewal);
}
