import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const customerController = new CustomerController();

// Public routes
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomerById);

// Protected routes
router.post('/', isAuth, isSeller, customerController.createCustomer);
router.put('/:id', isAuth, customerController.updateCustomer);
router.delete('/:id', isAuth, isAdmin, customerController.deleteCustomer);

export default router; 