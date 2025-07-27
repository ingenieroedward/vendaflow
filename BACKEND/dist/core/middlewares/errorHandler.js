"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const AppError_1 = require("../errors/AppError");
const config_1 = require("../../config");
const logger_1 = require("../logger");
const errorHandler = (error, req, res, _next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    // Handle AppError instances
    if (error instanceof AppError_1.AppError) {
        statusCode = error.statusCode;
        message = error.message;
    }
    // Handle Sequelize validation errors
    else if (error.name === 'SequelizeValidationError') {
        statusCode = 422;
        message = 'Validation Error';
    }
    // Handle Sequelize unique constraint errors
    else if (error.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        message = 'Resource already exists';
    }
    // Handle JWT errors
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    // Handle JWT expiration
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    // Log the error
    (0, logger_1.logError)('Error handled by middleware', error, {
        statusCode,
        message,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
    });
    const errorResponse = {
        status: 'error',
        message,
    };
    // Include stack trace in development
    if (config_1.config.server.nodeEnv === 'development' && error.stack) {
        errorResponse.stack = error.stack;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found`,
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map