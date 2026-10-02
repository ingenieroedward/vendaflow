import { Router } from 'express';
import { PurchaseOrderController } from './purchase-order.controller';
import { isAuth, isSeller, isAdmin } from '@/core/middlewares/auth';

const router = Router();
const controller = new PurchaseOrderController();

router.get('/', isAuth, isSeller, controller.getAll);
router.get('/:id', isAuth, isSeller, controller.getById);
router.post('/', isAuth, isSeller, controller.create);
router.put('/:id', isAuth, isSeller, controller.update);
router.delete('/:id', isAuth, isAdmin, controller.delete);

export default router;
