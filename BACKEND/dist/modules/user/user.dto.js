"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
// Validation schemas
exports.createUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(255),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['buyer', 'admin', 'seller']).default('buyer'),
});
exports.updateUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(255).optional(),
    role: zod_1.z.enum(['buyer', 'admin', 'seller']).optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
});
//# sourceMappingURL=user.dto.js.map