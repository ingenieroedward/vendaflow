import { Router } from 'express';
import { PushController } from './push.controller';
import { isAuth } from '@/core/middlewares/auth';
import { tenantScope } from '@/core/middlewares/tenantScope';

const router = Router();
const pushController = new PushController();

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', isAuth, tenantScope, pushController.subscribe);
router.delete('/unsubscribe', isAuth, tenantScope, pushController.unsubscribe);

export default router;
