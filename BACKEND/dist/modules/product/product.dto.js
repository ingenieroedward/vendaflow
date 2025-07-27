"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProductSchema = exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
// Create Product DTO
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long'),
    code: zod_1.z.string().min(1, 'Code is required').max(50, 'Code too long'),
    unit: zod_1.z.string().min(1, 'Unit is required').max(50, 'Unit too long'),
    salePrice: zod_1.z.number().min(0, 'Sale price must be positive'),
    categoryId: zod_1.z.number().nullable().optional(),
});
// Update Product DTO
exports.updateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    code: zod_1.z.string().min(1, 'Code is required').max(50, 'Code too long').optional(),
    unit: zod_1.z.string().min(1, 'Unit is required').max(50, 'Unit too long').optional(),
    salePrice: zod_1.z.number().min(0, 'Sale price must be positive').optional(),
    categoryId: zod_1.z.number().nullable().optional(),
});
// Search Product DTO
exports.searchProductSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Search query is required'),
});
//# sourceMappingURL=product.dto.js.map