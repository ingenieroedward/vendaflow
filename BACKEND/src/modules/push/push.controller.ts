import { Response } from 'express';
import { AuthenticatedRequest } from '@/core/middlewares/auth';
import { pushService, SubscriptionPayload } from './push.service';
import { config } from '@/config';
import { asyncHandler } from '@/core/middlewares/asyncHandler';
import { AppError } from '@/core/errors/AppError';

export class PushController {
  getVapidPublicKey = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ publicKey: config.vapid.publicKey });
  });

  sendTest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await pushService.sendTestToUser(req.user!.id);
    res.json({ status: 'success', data: result });
  });

  subscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const subscription = req.body as SubscriptionPayload;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new AppError('Invalid subscription payload', 400);
    }

    await pushService.subscribe(userId, subscription);
    res.status(201).json({ message: 'Subscribed successfully' });
  });

  unsubscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { endpoint } = req.body as { endpoint: string };

    if (!endpoint) {
      throw new AppError('Endpoint required', 400);
    }

    await pushService.unsubscribe(endpoint);
    res.json({ message: 'Unsubscribed successfully' });
  });
}
