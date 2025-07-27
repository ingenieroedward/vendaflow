"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const errorHandler_1 = require("./core/middlewares/errorHandler");
const logger_1 = require("./core/middlewares/logger");
// Import routes
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const category_routes_1 = __importDefault(require("./modules/category/category.routes"));
const product_routes_1 = __importDefault(require("./modules/product/product.routes"));
const supplier_routes_1 = __importDefault(require("./modules/supplier/supplier.routes"));
const price_routes_1 = __importDefault(require("./modules/price/price.routes"));
const customer_routes_1 = __importDefault(require("./modules/customer/customer.routes"));
const order_routes_1 = __importDefault(require("./modules/order/order.routes"));
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: config_1.config.cors.origin,
    credentials: true,
}));
// Logging middleware
app.use(logger_1.httpLogger);
app.use(logger_1.requestLogger);
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.windowMs,
    max: config_1.config.rateLimit.maxRequests,
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again later.',
    },
});
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Compression middleware
app.use((0, compression_1.default)());
// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: config_1.config.server.nodeEnv,
    });
});
// API routes
app.use('/api/auth', limiter, auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/suppliers', supplier_routes_1.default);
app.use('/api/prices', price_routes_1.default);
app.use('/api/customers', customer_routes_1.default);
app.use('/api/orders', order_routes_1.default);
// 404 handler
app.use('*', errorHandler_1.notFoundHandler);
// Error logging middleware
app.use(logger_1.errorLogger);
// Global error handler (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map