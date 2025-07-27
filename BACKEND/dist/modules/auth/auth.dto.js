"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// Login DTO
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(255),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
// Register DTO
exports.registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(255),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['buyer', 'admin']).default('buyer'),
});
//# sourceMappingURL=auth.dto.js.map