"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorLogger = exports.requestLogger = exports.httpLogger = void 0;
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = require("../logger");
// Morgan middleware for HTTP request logging
exports.httpLogger = (0, morgan_1.default)('combined', { stream: logger_1.logStream });
// Custom logging middleware for additional request details
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // Log request start
    (0, logger_1.logInfo)('Request started', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
    });
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        // Log response
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('Content-Length'),
            userId: req.user?.id,
        };
        if (res.statusCode >= 400) {
            (0, logger_1.logError)('Request failed', undefined, logData);
        }
        else {
            (0, logger_1.logInfo)('Request completed', logData);
        }
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.requestLogger = requestLogger;
// Error logging middleware
const errorLogger = (error, req, _res, next) => {
    (0, logger_1.logError)('Unhandled error', error, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id,
    });
    next(error);
};
exports.errorLogger = errorLogger;
//# sourceMappingURL=logger.js.map