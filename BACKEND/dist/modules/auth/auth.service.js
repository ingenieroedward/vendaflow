"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../user/user.model");
const user_service_1 = require("../user/user.service");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const config_1 = require("../../config");
const auth_dto_1 = require("./auth.dto");
class AuthService {
    constructor() {
        this.userService = new user_service_1.UserService();
    }
    async register(userData) {
        const validatedData = (0, validation_1.validateSchema)(auth_dto_1.registerSchema, userData);
        // Create user using UserService
        const user = await this.userService.createUser(validatedData);
        // Generate token
        const token = this.generateToken(user.id, user.username, user.role);
        return {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            token,
        };
    }
    async login(credentials) {
        const validatedData = (0, validation_1.validateSchema)(auth_dto_1.loginSchema, credentials);
        // Find user by username
        const user = await user_model_1.User.findOne({ where: { username: validatedData.username } });
        if (!user) {
            throw new AppError_1.UnauthorizedError('Invalid username or password');
        }
        // Verify password
        const isPasswordValid = await user.comparePassword(validatedData.password);
        if (!isPasswordValid) {
            throw new AppError_1.UnauthorizedError('Invalid username or password');
        }
        // Generate token
        const token = this.generateToken(user.id, user.username, user.role);
        return {
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            token,
        };
    }
    async getCurrentUser(userId) {
        return await this.userService.getUserById(userId);
    }
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        }
        catch (error) {
            throw new AppError_1.UnauthorizedError('Invalid token');
        }
    }
    generateToken(userId, username, role) {
        const payload = {
            userId,
            username,
            role,
        };
        return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map