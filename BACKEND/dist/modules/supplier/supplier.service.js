"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierService = void 0;
const supplier_model_1 = require("./supplier.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const supplier_dto_1 = require("./supplier.dto");
class SupplierService {
    async createSupplier(supplierData) {
        const validatedData = (0, validation_1.validateSchema)(supplier_dto_1.createSupplierSchema, supplierData);
        // Check if supplier already exists
        const existingSupplier = await supplier_model_1.Supplier.findOne({ where: { name: validatedData.name } });
        if (existingSupplier) {
            throw new AppError_1.ConflictError('Supplier with this name already exists');
        }
        const supplier = await supplier_model_1.Supplier.create(validatedData);
        return this.mapToResponseDto(supplier);
    }
    async getAllSuppliers(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await supplier_model_1.Supplier.findAndCountAll({
            limit: validatedLimit,
            offset,
            order: [['name', 'ASC']],
        });
        const suppliers = rows.map(supplier => this.mapToResponseDto(supplier));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            suppliers,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getSupplierById(id) {
        const supplier = await supplier_model_1.Supplier.findByPk(id);
        if (!supplier) {
            throw new AppError_1.NotFoundError('Supplier not found');
        }
        return this.mapToResponseDto(supplier);
    }
    async updateSupplier(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(supplier_dto_1.updateSupplierSchema, updateData);
        const supplier = await supplier_model_1.Supplier.findByPk(id);
        if (!supplier) {
            throw new AppError_1.NotFoundError('Supplier not found');
        }
        // Check if name is being updated and if it already exists
        if (validatedData.name && validatedData.name !== supplier.name) {
            const existingSupplier = await supplier_model_1.Supplier.findOne({ where: { name: validatedData.name } });
            if (existingSupplier) {
                throw new AppError_1.ConflictError('Supplier with this name already exists');
            }
        }
        await supplier.update(validatedData);
        return this.mapToResponseDto(supplier);
    }
    async deleteSupplier(id) {
        const supplier = await supplier_model_1.Supplier.findByPk(id);
        if (!supplier) {
            throw new AppError_1.NotFoundError('Supplier not found');
        }
        await supplier.destroy();
    }
    mapToResponseDto(supplier) {
        return {
            id: supplier.id,
            name: supplier.name,
            contact: supplier.contact,
            location: supplier.location,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        };
    }
}
exports.SupplierService = SupplierService;
//# sourceMappingURL=supplier.service.js.map