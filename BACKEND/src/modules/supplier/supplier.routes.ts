import { Router } from 'express';
import { SupplierController } from './supplier.controller';
import { isAuth, isAdmin, isBuyer } from '@/core/middlewares/auth';

const router = Router();
const supplierController = new SupplierController();

// Public routes
router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);

// Protected routes (buyer + admin for mutations, admin only for delete)
router.post('/', isAuth, isBuyer, supplierController.createSupplier);
router.put('/:id', isAuth, isBuyer, supplierController.updateSupplier);
router.delete('/:id', isAuth, isAdmin, supplierController.deleteSupplier);

export default router; 