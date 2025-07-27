"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("./order.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const orderController = new order_controller_1.OrderController();
// Public routes
router.get('/', orderController.getAllOrders);
router.get('/search', orderController.searchOrders);
router.get('/next-number', orderController.getNextOrderNumber);
router.get('/:id', orderController.getOrderById);
router.get('/customer/:customerId', orderController.getOrdersByCustomer);
// Protected routes
router.post('/', auth_1.isAuth, auth_1.isSeller, orderController.createOrder);
router.put('/:id', auth_1.isAuth, orderController.updateOrder);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, orderController.deleteOrder);
exports.default = router;
//# sourceMappingURL=order.routes.js.map