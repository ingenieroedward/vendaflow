"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const product_service_1 = require("./product.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class ProductController {
    constructor() {
        this.createProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const productData = req.body;
            const product = await this.productService.createProduct(productData);
            res.status(201).json({
                status: 'success',
                data: product,
            });
        });
        this.getAllProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.productService.getAllProducts(req.query);
            res.status(200).json({
                status: 'success',
                data: result.products,
                pagination: result.pagination,
            });
        });
        this.getAllProductsPrices = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.productService.getAllProducts(req.query, true);
            res.status(200).json({
                status: 'success',
                data: result.products,
                pagination: result.pagination,
            });
        });
        this.getProductById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const product = await this.productService.getProductById(Number(id));
            res.status(200).json({
                status: 'success',
                data: product,
            });
        });
        this.updateProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const product = await this.productService.updateProduct(Number(id), updateData);
            res.status(200).json({
                status: 'success',
                data: product,
            });
        });
        this.deleteProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.productService.deleteProduct(Number(id));
            res.status(204).send();
        });
        this.searchProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const searchData = req.query;
            const products = await this.productService.searchProducts(searchData);
            res.status(200).json({
                status: 'success',
                data: products,
            });
        });
        this.searchProductsPrices = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const searchData = req.query;
            const products = await this.productService.searchProducts(searchData, true);
            res.status(200).json({
                status: 'success',
                data: products,
            });
        });
        this.getProductsByCategory = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { categoryId } = req.params;
            const result = await this.productService.getProductsByCategory(Number(categoryId), req.query);
            res.status(200).json({
                status: 'success',
                data: result.products,
                pagination: result.pagination,
            });
        });
        this.productService = new product_service_1.ProductService();
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map