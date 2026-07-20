import { Router } from 'express';
import { PriceController } from './price.controller';
import { isAuth, isAdmin, isBuyer } from '@/core/middlewares/auth';

const router = Router();
const priceController = new PriceController();

router.get('/', isAuth, priceController.getAllPrices);
router.get('/:id', isAuth, priceController.getPriceById);
router.get('/product/:productId', isAuth, priceController.getPricesByProduct);

// Protected routes (buyer + admin for mutations, admin only for delete)
router.post('/', isAuth, isBuyer, priceController.createPrice);
router.put('/:id', isAuth, isBuyer, priceController.updatePrice);
router.delete('/:id', isAuth, isAdmin, priceController.deletePrice);

export default router; 