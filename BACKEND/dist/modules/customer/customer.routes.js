"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customer_controller_1 = require("./customer.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const customerController = new customer_controller_1.CustomerController();
// Public routes
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomerById);
// Protected routes
router.post('/', auth_1.isAuth, auth_1.isSeller, customerController.createCustomer);
router.put('/:id', auth_1.isAuth, customerController.updateCustomer);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, customerController.deleteCustomer);
exports.default = router;
//# sourceMappingURL=customer.routes.js.map