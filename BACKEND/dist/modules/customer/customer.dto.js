"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCustomerSchema = exports.updateCustomerSchema = exports.createCustomerSchema = void 0;
const zod_1 = require("zod");
// Create Customer DTO
exports.createCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long'),
    contact: zod_1.z.string().max(255, 'Contact too long').optional(),
    address: zod_1.z.string().max(255, 'Address too long').optional(),
    note: zod_1.z.string().max(255, 'Note too long').optional(),
});
// Update Customer DTO
exports.updateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    contact: zod_1.z.string().max(255, 'Contact too long').optional(),
    address: zod_1.z.string().max(255, 'Address too long').optional(),
    note: zod_1.z.string().max(255, 'Note too long').optional(),
});
// Search Customer DTO
exports.searchCustomerSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Search query is required'),
});
//# sourceMappingURL=customer.dto.js.map