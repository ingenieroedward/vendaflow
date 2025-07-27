"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
const customer_service_1 = require("./customer.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class CustomerController {
    constructor() {
        this.createCustomer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const customerData = req.body;
            const customer = await this.customerService.createCustomer(customerData);
            res.status(201).json({
                status: 'success',
                data: customer,
            });
        });
        this.getAllCustomers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const result = await this.customerService.getAllCustomers(req.query);
            res.status(200).json({
                status: 'success',
                data: result.customers,
                pagination: result.pagination,
            });
        });
        this.getCustomerById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const customer = await this.customerService.getCustomerById(Number(id));
            res.status(200).json({
                status: 'success',
                data: customer,
            });
        });
        this.updateCustomer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const customer = await this.customerService.updateCustomer(Number(id), updateData);
            res.status(200).json({
                status: 'success',
                data: customer,
            });
        });
        this.deleteCustomer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.customerService.deleteCustomer(Number(id));
            res.status(204).send();
        });
        this.searchCustomers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const searchData = req.query;
            const customers = await this.customerService.searchCustomers(searchData);
            res.status(200).json({
                status: 'success',
                data: customers,
            });
        });
        this.customerService = new customer_service_1.CustomerService();
    }
}
exports.CustomerController = CustomerController;
//# sourceMappingURL=customer.controller.js.map