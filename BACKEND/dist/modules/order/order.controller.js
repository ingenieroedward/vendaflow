"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("./order.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class OrderController {
    constructor() {
        this.createOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const orderData = req.body;
            const userId = req.user.id;
            const order = await this.orderService.createOrder(orderData, userId);
            res.status(201).json({
                status: 'success',
                data: order,
            });
        });
        this.getAllOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.orderService.getAllOrders(req.query);
            res.status(200).json({
                status: 'success',
                data: result.orders,
                pagination: result.pagination,
            });
        });
        this.getOrderById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const order = await this.orderService.getOrderById(Number(id));
            res.status(200).json({
                status: 'success',
                data: order,
            });
        });
        this.updateOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const order = await this.orderService.updateOrder(Number(id), updateData);
            res.status(200).json({
                status: 'success',
                data: order,
            });
        });
        this.deleteOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.orderService.deleteOrder(Number(id));
            res.status(204).send();
        });
        this.searchOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const searchData = req.query;
            const orders = await this.orderService.searchOrders(searchData);
            res.status(200).json({
                status: 'success',
                data: orders,
            });
        });
        this.getNextOrderNumber = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
            const result = await this.orderService.getNextOrderNumber();
            res.status(200).json({
                status: 'success',
                data: result,
            });
        });
        this.getOrdersByCustomer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { customerId } = req.params;
            const result = await this.orderService.getOrdersByCustomer(Number(customerId), req.query);
            res.status(200).json({
                status: 'success',
                data: result.orders,
                pagination: result.pagination,
            });
        });
        this.orderService = new order_service_1.OrderService();
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map