import webpush from 'web-push';
import { config } from '@/config';
import { PushSubscription } from './push-subscription.model';
import logger from '@/core/logger';

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
} else {
  logger.warn('[PushService] VAPID keys not configured — push notifications disabled');
}

export interface SubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushService {
  async subscribe(userId: number, subscription: SubscriptionPayload): Promise<void> {
    const existing = await PushSubscription.findOne({ where: { endpoint: subscription.endpoint } });
    if (existing) {
      await existing.update({ userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth });
    } else {
      await PushSubscription.create({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    }
  }

  async unsubscribe(endpoint: string, userId: number): Promise<void> {
    await PushSubscription.destroy({ where: { endpoint, userId } });
  }

  // Envío de prueba al usuario actual con diagnóstico por suscripción
  async sendTestToUser(userId: number): Promise<{
    vapidConfigured: boolean;
    subscriptions: number;
    results: Array<{ endpoint: string; ok: boolean; statusCode?: number; error?: string }>;
  }> {
    const vapidConfigured = !!(config.vapid.publicKey && config.vapid.privateKey);
    const subs = await PushSubscription.findAll({ where: { userId } });
    const payload = JSON.stringify({
      title: 'Prueba de notificaciones',
      body: 'Si ves esto, las notificaciones push funcionan correctamente ✓',
      data: { url: '/' },
    });

    const results = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        results.push({ endpoint: sub.endpoint.slice(0, 60) + '…', ok: true });
      } catch (err: any) {
        results.push({
          endpoint: sub.endpoint.slice(0, 60) + '…',
          ok: false,
          statusCode: err.statusCode,
          error: String(err.body || err.message || err).slice(0, 300),
        });
        if (err.statusCode === 410) await sub.destroy();
      }
    }
    return { vapidConfigured, subscriptions: subs.length, results };
  }

  // Notifica solo a los usuarios indicados (todas sus suscripciones/dispositivos)
  async notifyUsers(userIds: number[], title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (userIds.length === 0) return;
    const subscriptions = await PushSubscription.findAll({ where: { userId: userIds } });
    await this.sendToSubscriptions(subscriptions, title, body, data);
  }

  async notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const subscriptions = await PushSubscription.findAll();
    await this.sendToSubscriptions(subscriptions, title, body, data);
  }

  // Notifica a todos los usuarios de UN tenant (las suscripciones no guardan
  // tenantId, así que se resuelve vía los usuarios del tenant)
  async notifyTenant(tenantId: number, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const { User } = await import('@/modules/user/user.model');
    const users = await User.findAll({ where: { tenantId }, attributes: ['id'] });
    await this.notifyUsers(users.map(u => u.id), title, body, data);
  }

  private async sendToSubscriptions(
    subscriptions: PushSubscription[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {

    const payload = JSON.stringify({ title, body, data });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err: any) {
          // 410 Gone = subscription expired, remove it
          if (err.statusCode === 410) {
            await sub.destroy();
          } else {
            throw err;
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`[PushService] ${failed} notification(s) failed out of ${subscriptions.length}`);
    }
  }
}

export const pushService = new PushService();
