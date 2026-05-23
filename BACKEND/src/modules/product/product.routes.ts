import { Router } from 'express';
import { ProductController } from './product.controller';
import { isAuth, isAdmin, isBuyer } from '@/core/middlewares/auth';

const router = Router();
const productController = new ProductController();

// Public routes
router.get('/', productController.getAllProducts);
router.get('/prices', productController.getAllProductsPrices);
router.get('/search', productController.searchProducts);
router.get('/search/prices', productController.searchProductsPrices);

router.get('/:id', productController.getProductById);
router.get('/category/:categoryId', productController.getProductsByCategory);

// Protected routes (buyer + admin for mutations, admin only for delete)
router.post('/', isAuth, isBuyer, productController.createProduct);
router.put('/:id', isAuth, isBuyer, productController.updateProduct);
router.delete('/:id', isAuth, isAdmin, productController.deleteProduct);

export default router; 