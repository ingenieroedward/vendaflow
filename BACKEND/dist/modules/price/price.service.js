"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceService = void 0;
const price_model_1 = require("./price.model");
const product_model_1 = require("../product/product.model");
const supplier_model_1 = require("../supplier/supplier.model");
const user_model_1 = require("../user/user.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const price_dto_1 = require("./price.dto");
class PriceService {
    async createPrice(priceData, userId) {
        const validatedData = (0, validation_1.validateSchema)(price_dto_1.createPriceSchema, priceData);
        // Check if product exists
        const product = await product_model_1.Product.findByPk(validatedData.productId);
        if (!product) {
            throw new AppError_1.NotFoundError('Product not found');
        }
        // Check if supplier exists
        const supplier = await supplier_model_1.Supplier.findByPk(validatedData.supplierId);
        if (!supplier) {
            throw new AppError_1.NotFoundError('Supplier not found');
        }
        // Check if price already exists for this product and supplier
        const existingPrice = await price_model_1.Price.findOne({
            where: {
                productId: validatedData.productId,
                supplierId: validatedData.supplierId,
            },
        });
        if (existingPrice) {
            throw new AppError_1.ConflictError('Price already exists for this product and supplier');
        }
        const price = await price_model_1.Price.create({
            ...validatedData,
            updatedByUserId: userId,
        });
        return this.mapToResponseDto(price);
    }
    async getAllPrices(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await price_model_1.Price.findAndCountAll({
            limit: validatedLimit,
            offset,
            order: [['updatedAt', 'DESC']],
            include: [
                { model: product_model_1.Product, as: 'product' },
                { model: supplier_model_1.Supplier, as: 'supplier' },
                { model: user_model_1.User, as: 'updatedByUser' },
            ],
        });
        const prices = rows.map(price => this.mapToResponseDto(price));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            prices,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getPriceById(id) {
        const price = await price_model_1.Price.findByPk(id, {
            include: [
                { model: product_model_1.Product, as: 'product' },
                { model: supplier_model_1.Supplier, as: 'supplier' },
                { model: user_model_1.User, as: 'updatedByUser' },
            ],
        });
        if (!price) {
            throw new AppError_1.NotFoundError('Price not found');
        }
        return this.mapToResponseDto(price);
    }
    async updatePrice(id, updateData, userId) {
        const validatedData = (0, validation_1.validatePartialSchema)(price_dto_1.updatePriceSchema, updateData);
        const price = await price_model_1.Price.findByPk(id);
        if (!price) {
            throw new AppError_1.NotFoundError('Price not found');
        }
        if (Number(price.price) === Number(validatedData.price)) {
            return this.mapToResponseDto(price);
        }
        await price.update({
            ...validatedData,
            updatedByUserId: userId,
        });
        return this.mapToResponseDto(price);
    }
    async deletePrice(id) {
        const price = await price_model_1.Price.findByPk(id);
        if (!price) {
            throw new AppError_1.NotFoundError('Price not found');
        }
        await price.destroy();
    }
    async getPricesByProduct(productId) {
        const prices = await price_model_1.Price.findAll({
            where: { productId },
            include: [
                { model: supplier_model_1.Supplier, as: 'supplier' },
                { model: user_model_1.User, as: 'updatedByUser' },
            ],
            order: [['updatedAt', 'DESC']],
        });
        return prices.map(price => this.mapToResponseDto(price));
    }
    mapToResponseDto(price) {
        return {
            id: price.id,
            productId: price.productId,
            supplierId: price.supplierId,
            price: price.price,
            updatedByUserId: price.updatedByUserId,
            ...(price.product && {
                product: {
                    id: price.product.id,
                    name: price.product.name,
                    unit: price.product.unit,
                }
            }),
            ...(price.supplier && {
                supplier: {
                    id: price.supplier.id,
                    name: price.supplier.name,
                    contact: price.supplier.contact,
                    location: price.supplier.location,
                }
            }),
            ...(price.updatedByUser && {
                updatedByUser: {
                    id: price.updatedByUser.id,
                    username: price.updatedByUser.username,
                }
            }),
            createdAt: price.createdAt,
            updatedAt: price.updatedAt,
        };
    }
}
exports.PriceService = PriceService;
//# sourceMappingURL=price.service.js.map