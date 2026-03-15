import webpush from 'web-push';
import { config } from '@/config';
import { PushSubscription } from './push-subscription.model';
import logger from '@/core/logger';

webpush.setVapidDetails(
  config.vapid.subject,
  config.vapid.publicKey,
  config.vapid.privateKey,
);

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

  async unsubscribe(endpoint: string): Promise<void> {
    await PushSubscription.destroy({ where: { endpoint } });
  }

  async notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const subscriptions = await PushSubscription.findAll();

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
