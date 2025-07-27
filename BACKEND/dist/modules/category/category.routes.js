"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const category_controller_1 = require("./category.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const categoryController = new category_controller_1.CategoryController();
// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
// Protected routes (admin only)
router.post('/', auth_1.isAuth, auth_1.isAdmin, categoryController.createCategory);
router.put('/:id', auth_1.isAuth, auth_1.isAdmin, categoryController.updateCategory);
router.delete('/:id', auth_1.isAuth, auth_1.isAdmin, categoryController.deleteCategory);
exports.default = router;
//# sourceMappingURL=category.routes.js.map