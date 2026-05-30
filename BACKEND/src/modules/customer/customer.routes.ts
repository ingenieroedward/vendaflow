import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const customerController = new CustomerController();

// Protected routes (all require auth)
router.get('/', isAuth, customerController.getAllCustomers);
router.get('/search', isAuth, customerController.searchCustomers);
router.get('/:id', isAuth, customerController.getCustomerById);

router.get('/trash', isAuth, isAdmin, customerController.getDeletedCustomers);
router.post('/:id/restore', isAuth, isAdmin, customerController.restoreCustomer);
router.delete('/:id/permanent', isAuth, isAdmin, customerController.hardDeleteCustomer);

router.post('/', isAuth, isSeller, customerController.createCustomer);
router.put('/:id', isAuth, customerController.updateCustomer);
router.delete('/:id', isAuth, isAdmin, customerController.deleteCustomer);

export default router; 