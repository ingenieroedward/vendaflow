"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class AuthController {
    constructor() {
        // POST /api/auth/register
        this.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.authService.register(req.body);
            res.status(201).json({
                status: 'success',
                data: result,
            });
        });
        // POST /api/auth/login
        this.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.authService.login(req.body);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        });
        // GET /api/auth/me
        this.getCurrentUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const userId = req.user.id;
            const user = await this.authService.getCurrentUser(userId);
            res.status(200).json({
                status: 'success',
                data: user,
            });
        });
        this.authService = new auth_service_1.AuthService();
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map