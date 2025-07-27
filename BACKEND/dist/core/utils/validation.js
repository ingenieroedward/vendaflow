"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamSchema = exports.paginationSchema = exports.validatePartialSchema = exports.validateSchema = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
const validateSchema = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessage = error.errors.map(err => err.message).join(', ');
            throw new AppError_1.ValidationError(errorMessage);
        }
        throw error;
    }
};
exports.validateSchema = validateSchema;
const validatePartialSchema = (schema, data) => {
    try {
        return schema.partial().parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessage = error.errors.map(err => err.message).join(', ');
            throw new AppError_1.ValidationError(errorMessage);
        }
        throw error;
    }
};
exports.validatePartialSchema = validatePartialSchema;
// Common validation schemas
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).default(10),
});
exports.idParamSchema = zod_1.z.object({
    id: zod_1.z.coerce.number().positive(),
});
//# sourceMappingURL=validation.js.map