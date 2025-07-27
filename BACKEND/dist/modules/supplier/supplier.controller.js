"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierController = void 0;
const supplier_service_1 = require("./supplier.service");
const asyncHandler_1 = require("../../core/middlewares/asyncHandler");
class SupplierController {
    constructor() {
        this.createSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const supplierData = req.body;
            const supplier = await this.supplierService.createSupplier(supplierData);
            res.status(201).json({
                status: 'success',
                data: supplier,
            });
        });
        this.getAllSuppliers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const query = req.query;
            const result = await this.supplierService.getAllSuppliers(query);
            res.status(200).json({
                status: 'success',
                data: result.suppliers,
                pagination: result.pagination,
            });
        });
        this.getSupplierById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const supplier = await this.supplierService.getSupplierById(Number(id));
            res.status(200).json({
                status: 'success',
                data: supplier,
            });
        });
        this.updateSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;
            const supplier = await this.supplierService.updateSupplier(Number(id), updateData);
            res.status(200).json({
                status: 'success',
                data: supplier,
            });
        });
        this.deleteSupplier = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            await this.supplierService.deleteSupplier(Number(id));
            res.status(204).send();
        });
        this.supplierService = new supplier_service_1.SupplierService();
    }
}
exports.SupplierController = SupplierController;
//# sourceMappingURL=supplier.controller.js.map