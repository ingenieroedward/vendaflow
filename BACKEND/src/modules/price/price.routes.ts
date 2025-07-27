import { Router } from 'express';
import { PriceController } from './price.controller';
import { isAuth, isAdmin } from '@/core/middlewares/auth';

const router = Router();
const priceController = new PriceController();

// Public routes
router.get('/', priceController.getAllPrices);
router.get('/:id', priceController.getPriceById);
router.get('/product/:productId', priceController.getPricesByProduct);

// Protected routes (admin only)
router.post('/', isAuth, priceController.createPrice);
router.put('/:id', isAuth, priceController.updatePrice);
router.delete('/:id', isAuth, isAdmin, priceController.deletePrice);

export default router; 