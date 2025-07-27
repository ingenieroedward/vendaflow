"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_1 = require("./product.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const productController = new product_controller_1.ProductController();
// Public routes
router.get('/', productController.getAllProducts);
router.get('/prices', productController.getAllProductsPrices);
router.get('/search', productController.searchProducts);
router.get('/search/prices', productController.searchProductsPrices);
router.get('/:id', productController.getProductById);
router.get('/category/:categoryId', productController.getProductsByCategory);
// Protected routes (admin only)
router.post('/', auth_1.isAuth, productController.createProduct);
router.put('/:id', auth_1.isAuth, productController.updateProduct);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, productController.deleteProduct);
exports.default = router;
//# sourceMappingURL=product.routes.js.map