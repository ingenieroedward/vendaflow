import { Router } from 'express';
import { OrderController } from './order.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const orderController = new OrderController();

// Public routes
router.get('/', orderController.getAllOrders);
router.get('/search', orderController.searchOrders);
router.get('/next-number', orderController.getNextOrderNumber);
router.get('/:id', orderController.getOrderById);
router.get('/customer/:customerId', orderController.getOrdersByCustomer);

// Protected routes
router.post('/', isAuth, isSeller, orderController.createOrder);
router.put('/:id', isAuth, orderController.updateOrder);
router.delete('/:id', isAuth, isAdmin, orderController.deleteOrder);

export default router; 