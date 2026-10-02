import { Router } from 'express';
import { StockMovementController } from './stock-movement.controller';
import { isAuth, isSeller } from '@/core/middlewares/auth';

const router = Router();
const controller = new StockMovementController();

router.get('/', isAuth, isSeller, controller.getAll);
router.get('/product/:productId', isAuth, isSeller, controller.getByProduct);

export default router;
