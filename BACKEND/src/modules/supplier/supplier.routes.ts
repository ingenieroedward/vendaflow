import { Router } from 'express';
import { SupplierController } from './supplier.controller';
import { isAuth, isAdmin } from '@/core/middlewares/auth';

const router = Router();
const supplierController = new SupplierController();

// Public routes
router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);

// Protected routes (admin only)
router.post('/', isAuth, supplierController.createSupplier);
router.put('/:id', isAuth, supplierController.updateSupplier);
router.delete('/:id', isAuth, isAdmin, supplierController.deleteSupplier);

export default router; 