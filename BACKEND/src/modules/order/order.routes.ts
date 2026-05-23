import { Router } from 'express';
import { OrderController } from './order.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const orderController = new OrderController();

// Protected routes (all require auth)
router.get('/', isAuth, orderController.getAllOrders);
router.get('/search', isAuth, orderController.searchOrders);
router.get('/next-number', isAuth, orderController.getNextOrderNumber);
router.get('/:id', isAuth, orderController.getOrderById);
router.get('/customer/:customerId', isAuth, orderController.getOrdersByCustomer);

router.post('/', isAuth, isSeller, orderController.createOrder);
router.put('/:id', isAuth, orderController.updateOrder);
router.delete('/:id', isAuth, isAdmin, orderController.deleteOrder);

export default router; 