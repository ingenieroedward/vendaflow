"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const price_controller_1 = require("./price.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const priceController = new price_controller_1.PriceController();
// Public routes
router.get('/', priceController.getAllPrices);
router.get('/:id', priceController.getPriceById);
router.get('/product/:productId', priceController.getPricesByProduct);
// Protected routes (admin only)
router.post('/', auth_1.isAuth, priceController.createPrice);
router.put('/:id', auth_1.isAuth, priceController.updatePrice);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, priceController.deletePrice);
exports.default = router;
//# sourceMappingURL=price.routes.js.map