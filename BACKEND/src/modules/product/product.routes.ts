import { Router } from 'express';
import { ProductController } from './product.controller';
import { isAuth, isAdmin, isBuyer, isSeller } from '@/core/middlewares/auth';

const router = Router();
const productController = new ProductController();

router.get('/', isAuth, productController.getAllProducts);
router.get('/prices', isAuth, productController.getAllProductsPrices);
router.get('/search', isAuth, productController.searchProducts);
router.get('/search/prices', isAuth, productController.searchProductsPrices);
router.get('/stock/alerts', isAuth, productController.getStockAlerts);
router.get('/next-code', isAuth, productController.getNextCode);
// isSeller (no isBuyer): mismo nivel de visibilidad que /orders/stats/profit — el costo
// de inventario es dato de rentabilidad, no de gestión de catálogo/proveedores.
router.get('/costs', isAuth, isSeller, productController.getCosts);

router.get('/:id', isAuth, productController.getProductById);
router.get('/category/:categoryId', isAuth, productController.getProductsByCategory);

// Protected routes (buyer + admin for mutations, admin only for delete)
router.post('/', isAuth, isBuyer, productController.createProduct);
router.put('/:id', isAuth, isBuyer, productController.updateProduct);
router.patch('/:id/stock', isAuth, isBuyer, productController.adjustStock);
router.delete('/:id', isAuth, isAdmin, productController.deleteProduct);

export default router; 