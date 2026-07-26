import { Op, literal } from 'sequelize';
import { Order } from '@/modules/order/order.model';
import { Customer } from '@/modules/customer/customer.model';
import { User } from '@/modules/user/user.model';
import { pushService } from '@/modules/push/push.service';
import logger from '@/core/logger';

const DEFAULT_REMINDER_DAYS = 3;
const RUN_EVERY_MS = 24 * 60 * 60 * 1000; // diario
const FIRST_RUN_DELAY_MS = 60 * 1000; // 1 min tras el arranque

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function dueLabel(dueDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `venció hace ${-days} día${days === -1 ? '' : 's'}`;
  if (days === 0) return 'vence HOY';
  if (days === 1) return 'vence mañana';
  return `vence el ${formatDate(dueDate)}`;
}

/**
 * Busca órdenes a crédito sin pagar cuya fecha límite está dentro de la
 * ventana de recordatorio (reminderDays antes, o ya vencidas) y envía push
 * a los admin y vendedores de cada tenant.
 */
export async function checkPaymentReminders(): Promise<void> {
  const orders = await Order.findAll({
    where: {
      paymentType: 'credit',
      paidAt: null,
      status: { [Op.ne]: 'cancelled' },
      paymentDueDate: {
        [Op.lte]: literal(`DATE_ADD(CURDATE(), INTERVAL COALESCE(reminderDays, ${DEFAULT_REMINDER_DAYS}) DAY)`),
      },
    },
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
    order: [['paymentDueDate', 'ASC']],
  });

  if (orders.length === 0) return;

  // Agrupar por tenant
  const byTenant = new Map<number, Order[]>();
  for (const o of orders) {
    const list = byTenant.get(o.tenantId) ?? [];
    list.push(o);
    byTenant.set(o.tenantId, list);
  }

  for (const [tenantId, tenantOrders] of byTenant) {
    const recipients = await User.findAll({
      where: { tenantId, role: ['admin', 'seller'] },
      attributes: ['id'],
    });

    const lines = tenantOrders.slice(0, 3).map(o => {
      const customer = o.customer?.name ?? 'cliente';
      return `${o.orderNumber} · ${customer} — ${dueLabel(o.paymentDueDate!)}`;
    });
    if (tenantOrders.length > 3) lines.push(`…y ${tenantOrders.length - 3} más`);

    const title = tenantOrders.length === 1 ? 'Cobro por vencer' : `${tenantOrders.length} cobros por vencer`;

    try {
      await pushService.notifyUsers(
        recipients.map(u => u.id),
        title,
        lines.join('\n'),
        { url: '/orders' },
      );
      logger.info(`[paymentReminders] Tenant ${tenantId}: ${tenantOrders.length} orden(es), ${recipients.length} destinatario(s)`);
    } catch (err) {
      logger.error(`[paymentReminders] Error notificando tenant ${tenantId}:`, err);
    }
  }
}

export function startPaymentReminderJob(): void {
  setTimeout(() => {
    checkPaymentReminders().catch(err => logger.error('[paymentReminders] Run failed:', err));
    setInterval(
      () => checkPaymentReminders().catch(err => logger.error('[paymentReminders] Run failed:', err)),
      RUN_EVERY_MS,
    );
  }, FIRST_RUN_DELAY_MS);
  logger.info('[paymentReminders] Job programado (diario)');
}
