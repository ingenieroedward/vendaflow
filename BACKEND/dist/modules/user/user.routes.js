"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const userController = new user_controller_1.UserController();
// Protected routes (admin only)
router.use(auth_1.isAuth, auth_1.isAdmin);
// GET /api/users - Get all users with pagination
router.get('/', userController.getAllUsers);
// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);
// POST /api/users - Create new user
router.post('/', userController.createUser);
// PUT /api/users/:id - Update user
router.put('/:id', userController.updateUser);
// DELETE /api/users/:id - Delete user (soft delete)
router.delete('/:id', userController.deleteUser);
// GET /api/users/:id/restore - Restore User
router.get('/:id/restore', userController.restoreUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map