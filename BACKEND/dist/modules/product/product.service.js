"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const product_model_1 = require("./product.model");
const category_model_1 = require("../category/category.model");
const price_model_1 = require("../price/price.model");
const supplier_model_1 = require("../supplier/supplier.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const product_dto_1 = require("./product.dto");
const sequelize_1 = require("sequelize");
class ProductService {
    async createProduct(productData) {
        const validatedData = (0, validation_1.validateSchema)(product_dto_1.createProductSchema, productData);
        // Check if category exists if provided
        if (validatedData.categoryId) {
            const category = await category_model_1.Category.findByPk(validatedData.categoryId);
            if (!category) {
                throw new AppError_1.NotFoundError('Category not found');
            }
        }
        const product = await product_model_1.Product.create(validatedData);
        return this.mapToResponseDto(product);
    }
    async getAllProducts(query, required_prices = false) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await product_model_1.Product.findAndCountAll({
            include: [
                {
                    model: category_model_1.Category,
                    as: 'category',
                    attributes: ['id', 'name'],
                },
                {
                    model: price_model_1.Price,
                    as: 'prices',
                    required: required_prices,
                    include: [
                        {
                            model: supplier_model_1.Supplier,
                            as: 'supplier',
                            attributes: ['id', 'name', 'contact', 'location'],
                        },
                    ],
                    order: [['updatedAt', 'DESC']],
                },
            ],
            limit: validatedLimit,
            offset,
            order: [['createdAt', 'DESC']],
        });
        const products = rows.map(product => this.mapToResponseDto(product));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            products,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getProductById(id) {
        const product = await product_model_1.Product.findOne({
            where: { id },
            include: [
                {
                    model: category_model_1.Category,
                    as: 'category',
                    attributes: ['id', 'name'],
                },
            ],
        });
        if (!product) {
            throw new AppError_1.NotFoundError('Product not found');
        }
        return this.mapToResponseDto(product);
    }
    async updateProduct(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(product_dto_1.updateProductSchema, updateData);
        const product = await product_model_1.Product.findByPk(id);
        if (!product) {
            throw new AppError_1.NotFoundError('Product not found');
        }
        // Check if category exists if provided
        if (validatedData.categoryId) {
            const category = await category_model_1.Category.findByPk(validatedData.categoryId);
            if (!category) {
                throw new AppError_1.NotFoundError('Category not found');
            }
        }
        await product.update(validatedData);
        return this.mapToResponseDto(product);
    }
    async deleteProduct(id) {
        const product = await product_model_1.Product.findByPk(id);
        if (!product) {
            throw new AppError_1.NotFoundError('Product not found');
        }
        await product.destroy();
    }
    async searchProducts(searchData, required_prices = true) {
        const validatedData = (0, validation_1.validateSchema)(product_dto_1.searchProductSchema, searchData);
        const products = await product_model_1.Product.findAll({
            where: {
                [sequelize_1.Op.or]: [
                    { name: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                    { code: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                ],
            },
            include: [
                {
                    model: category_model_1.Category,
                    as: 'category',
                    attributes: ['id', 'name'],
                },
                {
                    model: price_model_1.Price,
                    as: 'prices',
                    required: required_prices,
                    include: [
                        {
                            model: supplier_model_1.Supplier,
                            as: 'supplier',
                            attributes: ['id', 'name', 'contact', 'location'],
                        },
                    ],
                    order: [['updatedAt', 'DESC']],
                },
            ],
            order: [['name', 'ASC']],
        });
        return products.map(product => this.mapToResponseDto(product));
    }
    async getProductsByCategory(categoryId, query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await product_model_1.Product.findAndCountAll({
            where: { categoryId },
            include: [
                {
                    model: category_model_1.Category,
                    as: 'category',
                    attributes: ['id', 'name'],
                },
            ],
            limit: validatedLimit,
            offset,
            order: [['createdAt', 'DESC']],
        });
        const products = rows.map(product => this.mapToResponseDto(product));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            products,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    mapToResponseDto(product) {
        return {
            id: product.id,
            name: product.name,
            code: product.code,
            unit: product.unit,
            salePrice: Number(product.salePrice),
            categoryId: product.categoryId,
            ...(product.category && {
                category: {
                    id: product.category.id,
                    name: product.category.name,
                }
            }),
            ...(product.prices && product.prices.length > 0 && {
                prices: product.prices.map(price => ({
                    id: price.id,
                    price: Number(price.price),
                    supplier: price.supplier
                        ? {
                            id: price.supplier.id,
                            name: price.supplier.name,
                            contact: price.supplier.contact,
                            location: price.supplier.location,
                        }
                        : undefined,
                    updatedAt: price.updatedAt,
                }))
            }),
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        };
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map