import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const customerController = new CustomerController();

// Protected routes (all require auth)
router.get('/', isAuth, customerController.getAllCustomers);
router.get('/search', isAuth, customerController.searchCustomers);
router.get('/:id', isAuth, customerController.getCustomerById);

router.post('/', isAuth, isSeller, customerController.createCustomer);
router.put('/:id', isAuth, customerController.updateCustomer);
router.delete('/:id', isAuth, isAdmin, customerController.deleteCustomer);

export default router; 