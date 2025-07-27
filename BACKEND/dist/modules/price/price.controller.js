"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceController = void 0;
const price_service_1 = require("./price.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class PriceController {
    constructor() {
        this.createPrice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const priceData = req.body;
            const userId = req.user.id;
            const price = await this.priceService.createPrice(priceData, userId);
            res.status(201).json({
                status: 'success',
                data: price,
            });
        });
        this.getAllPrices = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const query = req.query;
            const result = await this.priceService.getAllPrices(query);
            res.status(200).json({
                status: 'success',
                data: result.prices,
                pagination: result.pagination,
            });
        });
        this.getPriceById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const price = await this.priceService.getPriceById(Number(id));
            res.status(200).json({
                status: 'success',
                data: price,
            });
        });
        this.updatePrice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const userId = req.user.id;
            const price = await this.priceService.updatePrice(Number(id), updateData, userId);
            res.status(200).json({
                status: 'success',
                data: price,
            });
        });
        this.deletePrice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.priceService.deletePrice(Number(id));
            res.status(204).send();
        });
        this.getPricesByProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { productId } = req.params;
            const prices = await this.priceService.getPricesByProduct(Number(productId));
            res.status(200).json({
                status: 'success',
                data: prices,
            });
        });
        this.priceService = new price_service_1.PriceService();
    }
}
exports.PriceController = PriceController;
//# sourceMappingURL=price.controller.js.map