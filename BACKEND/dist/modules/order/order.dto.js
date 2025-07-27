"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchOrderSchema = exports.updateOrderSchema = exports.createOrderSchema = exports.orderItemSchema = void 0;
const zod_1 = require("zod");
// Order Item DTO
exports.orderItemSchema = zod_1.z.object({
    productId: zod_1.z.number().positive('Product ID must be positive'),
    quantity: zod_1.z.number().min(1, 'Quantity must be at least 1'),
    taxRate: zod_1.z.number().min(0, 'Tax rate must must be positive'),
    unitPrice: zod_1.z.number().min(0, 'Unit price must be positive'),
});
// Create Order DTO
exports.createOrderSchema = zod_1.z.object({
    customerId: zod_1.z.number().positive('Customer ID must be positive'),
    orderNumber: zod_1.z.string().max(50, 'Order number too long').optional(),
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'cancelled']).default('pending'),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.orderItemSchema).min(1, 'At least one item is required'),
});
// Update Order DTO
exports.updateOrderSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'cancelled']).optional(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.orderItemSchema.partial().extend({ id: zod_1.z.number().optional() })).optional(),
});
// Search Order DTO
exports.searchOrderSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Search query is required'),
});
//# sourceMappingURL=order.dto.js.map