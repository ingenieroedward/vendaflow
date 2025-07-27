"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_model_1 = require("./user.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const user_dto_1 = require("./user.dto");
const order_model_1 = require("../order/order.model");
const price_model_1 = require("../price/price.model");
class UserService {
    async createUser(userData) {
        const validatedData = (0, validation_1.validateSchema)(user_dto_1.createUserSchema, userData);
        // Check if user already exists
        const existingUser = await user_model_1.User.findOne({
            where: { username: validatedData.username },
        });
        if (existingUser) {
            throw new AppError_1.ConflictError("User with this username already exists");
        }
        const user = await user_model_1.User.create(validatedData);
        return this.mapToResponseDto(user);
    }
    async getAllUsers(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await user_model_1.User.findAndCountAll({
            limit: validatedLimit,
            offset,
            order: [["createdAt", "DESC"]],
            paranoid: false,
        });
        const users = rows.map((user) => this.mapToResponseDto(user));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            users,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getUserById(id) {
        const user = await user_model_1.User.findByPk(id);
        if (!user) {
            throw new AppError_1.NotFoundError("User not found");
        }
        return this.mapToResponseDto(user);
    }
    async updateUser(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(user_dto_1.updateUserSchema, updateData);
        const user = await user_model_1.User.findByPk(id);
        if (!user) {
            throw new AppError_1.NotFoundError("User not found");
        }
        // Check if username is being updated and if it already exists
        if (validatedData.username && validatedData.username !== user.username) {
            const existingUser = await user_model_1.User.findOne({
                where: { username: validatedData.username },
            });
            if (existingUser) {
                throw new AppError_1.ConflictError("User with this username already exists");
            }
        }
        await user.update(validatedData);
        return this.mapToResponseDto(user);
    }
    async deleteUser(id) {
        const user = await user_model_1.User.findByPk(id);
        if (!user) {
            const userDeleted = await user_model_1.User.findByPk(id, {
                paranoid: false,
                include: [order_model_1.Order, price_model_1.Price],
            });
            if (userDeleted && userDeleted?.prices?.length > 0) {
                throw new AppError_1.ConflictError("El usuario tiene precios asignados");
            }
            if (userDeleted && userDeleted.orders.length > 0) {
                throw new AppError_1.ConflictError("El usuario tiene ordenes realizadas");
            }
            if (!userDeleted) {
                throw new AppError_1.NotFoundError("User not found");
            }
            return await userDeleted.destroy({ force: true });
        }
        return await user.destroy();
    }
    async restoreUser(id) {
        const user = await user_model_1.User.findByPk(id, { paranoid: false });
        if (!user) {
            throw new AppError_1.NotFoundError("User not found");
        }
        return await user.restore();
    }
    mapToResponseDto(user) {
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            deletedAt: user.deletedAt,
        };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map