"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supplier_controller_1 = require("./supplier.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const supplierController = new supplier_controller_1.SupplierController();
// Public routes
router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);
// Protected routes (admin only)
router.post('/', auth_1.isAuth, supplierController.createSupplier);
router.put('/:id', auth_1.isAuth, supplierController.updateSupplier);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, supplierController.deleteSupplier);
exports.default = router;
//# sourceMappingURL=supplier.routes.js.map