"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePriceSchema = exports.createPriceSchema = void 0;
const zod_1 = require("zod");
// Create Price DTO
exports.createPriceSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive('Product ID must be a positive integer'),
    supplierId: zod_1.z.number().int().positive('Supplier ID must be a positive integer'),
    price: zod_1.z.number().positive('Price must be positive'),
});
// Update Price DTO
exports.updatePriceSchema = zod_1.z.object({
    price: zod_1.z.number().positive('Price must be positive'),
});
//# sourceMappingURL=price.dto.js.map