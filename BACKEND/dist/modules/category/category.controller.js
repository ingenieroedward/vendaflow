"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const category_service_1 = require("./category.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class CategoryController {
    constructor() {
        this.createCategory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const categoryData = req.body;
            const category = await this.categoryService.createCategory(categoryData);
            res.status(201).json({
                status: 'success',
                data: category,
            });
        });
        this.getAllCategories = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const query = req.query;
            const result = await this.categoryService.getAllCategories(query);
            res.status(200).json({
                status: 'success',
                data: result.categories,
                pagination: result.pagination,
            });
        });
        this.getCategoryById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const category = await this.categoryService.getCategoryById(Number(id));
            res.status(200).json({
                status: 'success',
                data: category,
            });
        });
        this.updateCategory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const category = await this.categoryService.updateCategory(Number(id), updateData);
            res.status(200).json({
                status: 'success',
                data: category,
            });
        });
        this.deleteCategory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.categoryService.deleteCategory(Number(id));
            res.status(204).send();
        });
        this.categoryService = new category_service_1.CategoryService();
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=category.controller.js.map