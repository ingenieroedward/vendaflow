import { Router } from 'express';
import { PushController } from './push.controller';
import { isAuth } from '@/core/middlewares/auth';

const router = Router();
const pushController = new PushController();

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', isAuth, pushController.subscribe);
router.delete('/unsubscribe', isAuth, pushController.unsubscribe);

export default router;
