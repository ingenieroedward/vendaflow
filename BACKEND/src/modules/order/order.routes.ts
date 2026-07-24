import { Router } from 'express';
import { OrderController } from './order.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const orderController = new OrderController();

// Protected routes (all require auth)
router.get('/', isAuth, orderController.getAllOrders);
router.get('/search', isAuth, orderController.searchOrders);
router.get('/next-number', isAuth, orderController.getNextOrderNumber);
router.get('/trash', isAuth, isAdmin, orderController.getDeletedOrders);
router.get('/customer/:customerId', isAuth, orderController.getOrdersByCustomer);
router.get('/:id', isAuth, orderController.getOrderById);

router.post('/', isAuth, isSeller, orderController.createOrder);
router.post('/:id/restore', isAuth, isAdmin, orderController.restoreOrder);
router.put('/:id', isAuth, isSeller, orderController.updateOrder);
router.delete('/:id/permanent', isAuth, isAdmin, orderController.hardDeleteOrder);
router.delete('/:id', isAuth, isAdmin, orderController.deleteOrder);

export default router; 