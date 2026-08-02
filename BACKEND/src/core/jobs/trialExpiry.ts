import { Op } from 'sequelize';
import { Tenant } from '@/modules/tenant/tenant.model';
import { User } from '@/modules/user/user.model';
import { pushService } from '@/modules/push/push.service';
import logger from '@/core/logger';
import { scheduleDailyJob } from './dailyScheduler';
import { sendEmail, renderEmail } from '@/core/email';

const WARN_DAYS = 3; // avisar desde N días antes del vencimiento

async function notifyTenantAdmins(tenantId: number, title: string, body: string): Promise<void> {
  const admins = await User.findAll({ where: { tenantId, role: 'admin' }, attributes: ['id'] });
  await pushService.notifyUsers(admins.map(u => u.id), title, body, { url: '/settings' });
}

async function notifySuperadmins(title: string, body: string): Promise<void> {
  const superadmins = await User.findAll({ where: { role: 'superadmin' }, attributes: ['id'] });
  await pushService.notifyUsers(superadmins.map(u => u.id), title, body, { url: '/superadmin' });
}

/**
 * Gestión diaria de trials:
 * 1. Suspende tenants cuyo trial ya venció (tenantScope los bloquea ≤60s después)
 * 2. Avisa al admin del tenant y al superadmin cuando el trial está por vencer
 */
export async function checkTrialExpiry(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Suspender trials vencidos (el tenant demo queda exento: es la demo pública)
  const expired = await Tenant.findAll({
    where: { status: 'trial', trialEndsAt: { [Op.lt]: today }, slug: { [Op.ne]: 'demo' } },
  });

  for (const tenant of expired) {
    await tenant.update({ status: 'suspended', suspendedReason: 'trial_expired' });
    logger.info(`[trialExpiry] Tenant "${tenant.slug}" suspendido (trial venció ${tenant.trialEndsAt?.toISOString().slice(0, 10)})`);
    try {
      await notifyTenantAdmins(
        tenant.id,
        'Período de prueba finalizado',
        `Tu prueba de ${tenant.name} terminó y la cuenta fue suspendida. Contáctanos para activar un plan.`,
      );
      await sendEmail(tenant.contactEmail, 'Tu período de prueba terminó — Merco', renderEmail('Período de prueba finalizado', [
        `La prueba de <b>${tenant.name}</b> terminó y la cuenta fue suspendida.`,
        'Responde este correo o escríbenos para activar un plan y seguir donde quedaste — tus datos están intactos.',
      ]));
      await notifySuperadmins('Trial vencido — tenant suspendido', `${tenant.name} (${tenant.slug}) fue suspendido automáticamente.`);
    } catch (err) {
      logger.error(`[trialExpiry] Error notificando suspensión de ${tenant.slug}:`, err);
    }
  }

  // 2. Avisos de vencimiento próximo (dentro de WARN_DAYS)
  const warnLimit = new Date(today);
  warnLimit.setDate(warnLimit.getDate() + WARN_DAYS);

  const expiring = await Tenant.findAll({
    where: { status: 'trial', trialEndsAt: { [Op.gte]: today, [Op.lte]: warnLimit }, slug: { [Op.ne]: 'demo' } },
  });

  for (const tenant of expiring) {
    const days = Math.ceil((tenant.trialEndsAt!.getTime() - today.getTime()) / 86400000);
    const cuando = days <= 0 ? 'HOY' : days === 1 ? 'mañana' : `en ${days} días`;
    try {
      await notifyTenantAdmins(
        tenant.id,
        `Tu prueba vence ${cuando}`,
        `El período de prueba de ${tenant.name} termina ${cuando}. Activa un plan para no perder acceso.`,
      );
      await notifySuperadmins(`Trial por vencer ${cuando}`, `${tenant.name} (${tenant.slug}) — contactar para conversión a plan.`);
      logger.info(`[trialExpiry] Aviso enviado: ${tenant.slug} vence ${cuando}`);
    } catch (err) {
      logger.error(`[trialExpiry] Error avisando a ${tenant.slug}:`, err);
    }
  }

  if (expired.length === 0 && expiring.length === 0) {
    logger.info('[trialExpiry] Sin trials vencidos ni por vencer');
  }
}

export function startTrialExpiryJob(): void {
  scheduleDailyJob('trialExpiry', checkTrialExpiry);
}
