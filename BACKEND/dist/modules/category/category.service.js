"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const category_model_1 = require("./category.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const category_dto_1 = require("./category.dto");
class CategoryService {
    async createCategory(categoryData) {
        const validatedData = (0, validation_1.validateSchema)(category_dto_1.createCategorySchema, categoryData);
        // Check if category already exists
        const existingCategory = await category_model_1.Category.findOne({ where: { name: validatedData.name } });
        if (existingCategory) {
            throw new AppError_1.ConflictError('Category with this name already exists');
        }
        const category = await category_model_1.Category.create(validatedData);
        return this.mapToResponseDto(category);
    }
    async getAllCategories(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await category_model_1.Category.findAndCountAll({
            limit: validatedLimit,
            offset,
            order: [['name', 'ASC']],
        });
        const categories = rows.map(category => this.mapToResponseDto(category));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            categories,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getCategoryById(id) {
        const category = await category_model_1.Category.findByPk(id);
        if (!category) {
            throw new AppError_1.NotFoundError('Category not found');
        }
        return this.mapToResponseDto(category);
    }
    async updateCategory(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(category_dto_1.updateCategorySchema, updateData);
        const category = await category_model_1.Category.findByPk(id);
        if (!category) {
            throw new AppError_1.NotFoundError('Category not found');
        }
        // Check if name is being updated and if it already exists
        if (validatedData.name && validatedData.name !== category.name) {
            const existingCategory = await category_model_1.Category.findOne({ where: { name: validatedData.name } });
            if (existingCategory) {
                throw new AppError_1.ConflictError('Category with this name already exists');
            }
        }
        await category.update(validatedData);
        return this.mapToResponseDto(category);
    }
    async deleteCategory(id) {
        const category = await category_model_1.Category.findByPk(id);
        if (!category) {
            throw new AppError_1.NotFoundError('Category not found');
        }
        // Check if category is "Sin categoría" (default category)
        if (category.name === 'Sin categoría') {
            throw new AppError_1.ConflictError('Cannot delete the default category');
        }
        await category.destroy();
    }
    mapToResponseDto(category) {
        return {
            id: category.id,
            name: category.name,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        };
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map