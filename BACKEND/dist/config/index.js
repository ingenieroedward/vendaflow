"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
exports.config = {
    // Server configuration
    server: {
        port: process.env['PORT'] || 3000,
        nodeEnv: process.env['NODE_ENV'] || 'development',
    },
    // Database configuration
    database: {
        host: process.env['DB_HOST'] || 'localhost',
        port: parseInt(process.env['DB_PORT'] || '3306'),
        name: process.env['DB_NAME'] || 'express_ts_db',
        user: process.env['DB_USER'] || 'root',
        password: process.env['DB_PASSWORD'] || '',
        dialect: process.env['DB_DIALECT'] || 'mysql',
    },
    // JWT configuration
    jwt: {
        secret: process.env['JWT_SECRET'] || 'your_jwt_secret_key_here',
        expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    },
    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
        maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
    },
    // CORS configuration
    cors: {
        origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    },
    // Logging
    logging: {
        level: process.env['LOG_LEVEL'] || 'debug',
        maxFiles: process.env['LOG_MAX_FILES'] || '14d',
        maxSize: process.env['LOG_MAX_SIZE'] || '20m',
    },
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map