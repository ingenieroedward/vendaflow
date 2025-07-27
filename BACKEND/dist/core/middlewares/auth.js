"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.isSeller = exports.isBuyer = exports.isAdmin = exports.isAuth = void 0;
const auth_service_1 = require("../../modules/auth/auth.service");
const AppError_1 = require("../errors/AppError");
const authService = new auth_service_1.AuthService();
const isAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError_1.UnauthorizedError('Access token required');
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const payload = authService.verifyToken(token);
        // Add user info to request
        req.user = {
            id: payload.userId,
            username: payload.username,
            role: payload.role,
        };
        next();
    }
    catch (error) {
        next(new AppError_1.UnauthorizedError('Invalid or expired token'));
    }
};
exports.isAuth = isAuth;
const isAdmin = (req, _res, next) => {
    if (!req.user) {
        next(new AppError_1.UnauthorizedError('Authentication required'));
        return;
    }
    if (req.user.role !== 'admin') {
        next(new AppError_1.ForbiddenError('Admin access required'));
        return;
    }
    next();
};
exports.isAdmin = isAdmin;
const isBuyer = (req, _res, next) => {
    if (!req.user) {
        next(new AppError_1.UnauthorizedError('Authentication required'));
        return;
    }
    if (req.user.role !== 'buyer' && req.user.role !== 'admin') {
        next(new AppError_1.ForbiddenError('Buyer access required'));
        return;
    }
    next();
};
exports.isBuyer = isBuyer;
const isSeller = (req, _res, next) => {
    if (!req.user) {
        next(new AppError_1.UnauthorizedError('Authentication required'));
        return;
    }
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        next(new AppError_1.ForbiddenError('Seller access required'));
        return;
    }
    next();
};
exports.isSeller = isSeller;
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Continue without authentication
            next();
            return;
        }
        const token = authHeader.substring(7);
        const payload = authService.verifyToken(token);
        // Add user info to request
        req.user = {
            id: payload.userId,
            username: payload.username,
            role: payload.role,
        };
        next();
    }
    catch (error) {
        // Continue without authentication on token error
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map