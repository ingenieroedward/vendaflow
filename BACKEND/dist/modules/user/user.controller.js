"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
const validation_1 = require("../../core/utils/validation");
class UserController {
    constructor() {
        // GET /api/users
        this.getAllUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.userService.getAllUsers(req.query);
            res.status(200).json({
                status: 'success',
                data: result.users,
                pagination: result.pagination,
            });
        });
        // GET /api/users/:id
        this.getUserById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = (0, validation_1.validateSchema)(validation_1.idParamSchema, req.params);
            const user = await this.userService.getUserById(id);
            res.status(200).json({
                status: 'success',
                data: user,
            });
        });
        // POST /api/users
        this.createUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const user = await this.userService.createUser(req.body);
            res.status(201).json({
                status: 'success',
                data: user,
            });
        });
        // PUT /api/users/:id
        this.updateUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = (0, validation_1.validateSchema)(validation_1.idParamSchema, req.params);
            const user = await this.userService.updateUser(id, req.body);
            res.status(200).json({
                status: 'success',
                data: user,
            });
        });
        // DELETE /api/users/:id
        this.deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = (0, validation_1.validateSchema)(validation_1.idParamSchema, req.params);
            await this.userService.deleteUser(id);
            res.status(204).send();
        });
        // GET /api/users/:id/restore
        this.restoreUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = (0, validation_1.validateSchema)(validation_1.idParamSchema, req.params);
            const user = await this.userService.restoreUser(id);
            res.status(200).json({
                status: 'success',
                data: user,
            });
        });
        this.userService = new user_service_1.UserService();
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map