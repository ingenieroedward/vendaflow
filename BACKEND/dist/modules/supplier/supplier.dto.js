"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupplierSchema = exports.createSupplierSchema = void 0;
const zod_1 = require("zod");
// Create Supplier DTO
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long'),
    contact: zod_1.z.string().min(1, 'Contact is required').max(255, 'Contact too long'),
    location: zod_1.z.string().min(1, 'Location is required').max(255, 'Location too long'),
});
// Update Supplier DTO
exports.updateSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    contact: zod_1.z.string().min(1, 'Contact is required').max(255, 'Contact too long').optional(),
    location: zod_1.z.string().min(1, 'Location is required').max(255, 'Location too long').optional(),
});
//# sourceMappingURL=supplier.dto.js.map