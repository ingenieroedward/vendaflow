import { Router } from 'express';
import { OrderController } from './order.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const orderController = new OrderController();

// Protected routes (all require auth)
router.get('/', isAuth, isSeller, orderController.getAllOrders);
router.get('/search', isAuth, isSeller, orderController.searchOrders);
router.get('/next-number', isAuth, isSeller, orderController.getNextOrderNumber);
router.get('/stats/home', isAuth, isSeller, orderController.getHomeStats);
router.get('/receivables', isAuth, isSeller, orderController.getReceivables);
router.get('/trash', isAuth, isAdmin, orderController.getDeletedOrders);
router.get('/customer/:customerId', isAuth, isSeller, orderController.getOrdersByCustomer);
router.get('/:id', isAuth, isSeller, orderController.getOrderById);

router.post('/', isAuth, isSeller, orderController.createOrder);
router.post('/:id/restore', isAuth, isAdmin, orderController.restoreOrder);
router.put('/:id', isAuth, isSeller, orderController.updateOrder);
router.patch('/:id/pay', isAuth, isSeller, orderController.markPaid);
router.delete('/:id/permanent', isAuth, isAdmin, orderController.hardDeleteOrder);
router.delete('/:id', isAuth, isAdmin, orderController.deleteOrder);

export default router; 