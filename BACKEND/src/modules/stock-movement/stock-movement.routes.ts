import { Router } from 'express';
import { StockMovementController } from './stock-movement.controller';
import { isAuth } from '@/core/middlewares/auth';

const router = Router();
const controller = new StockMovementController();

router.get('/', isAuth, controller.getAll);
router.get('/product/:productId', isAuth, controller.getByProduct);

export default router;
