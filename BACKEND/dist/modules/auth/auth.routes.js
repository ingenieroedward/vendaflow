"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../core/middlewares/auth");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
// Protected routes
router.get('/me', auth_1.isAuth, authController.getCurrentUser);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map