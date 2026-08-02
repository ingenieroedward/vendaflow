import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const customerController = new CustomerController();

// Protected routes (all require auth)
router.get('/', isAuth, isSeller, customerController.getAllCustomers);
router.get('/search', isAuth, isSeller, customerController.searchCustomers);
// '/trash' debe ir antes de '/:id' — Express casa por orden y ':id' se tragaría "trash"
router.get('/trash', isAuth, isAdmin, customerController.getDeletedCustomers);
router.get('/:id', isAuth, isSeller, customerController.getCustomerById);
router.post('/:id/restore', isAuth, isAdmin, customerController.restoreCustomer);
router.delete('/:id/permanent', isAuth, isAdmin, customerController.hardDeleteCustomer);

router.post('/', isAuth, isSeller, customerController.createCustomer);
router.put('/:id', isAuth, isSeller, customerController.updateCustomer);
router.delete('/:id', isAuth, isAdmin, customerController.deleteCustomer);

export default router; 