"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const customer_model_1 = require("./customer.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const customer_dto_1 = require("./customer.dto");
const sequelize_1 = require("sequelize");
class CustomerService {
    async createCustomer(customerData) {
        const validatedData = (0, validation_1.validateSchema)(customer_dto_1.createCustomerSchema, customerData);
        const customer = await customer_model_1.Customer.create(validatedData);
        return this.mapToResponseDto(customer);
    }
    async getAllCustomers(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await customer_model_1.Customer.findAndCountAll({
            limit: validatedLimit,
            offset,
            order: [['createdAt', 'DESC']],
        });
        const customers = rows.map(customer => this.mapToResponseDto(customer));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            customers,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getCustomerById(id) {
        const customer = await customer_model_1.Customer.findByPk(id);
        if (!customer) {
            throw new AppError_1.NotFoundError('Customer not found');
        }
        return this.mapToResponseDto(customer);
    }
    async updateCustomer(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(customer_dto_1.updateCustomerSchema, updateData);
        const customer = await customer_model_1.Customer.findByPk(id);
        if (!customer) {
            throw new AppError_1.NotFoundError('Customer not found');
        }
        await customer.update(validatedData);
        return this.mapToResponseDto(customer);
    }
    async deleteCustomer(id) {
        const customer = await customer_model_1.Customer.findByPk(id);
        if (!customer) {
            throw new AppError_1.NotFoundError('Customer not found');
        }
        await customer.destroy();
    }
    async searchCustomers(searchData) {
        const validatedData = (0, validation_1.validateSchema)(customer_dto_1.searchCustomerSchema, searchData);
        const customers = await customer_model_1.Customer.findAll({
            where: {
                [sequelize_1.Op.or]: [
                    { name: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                    { contact: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                    { address: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                ],
            },
            order: [['name', 'ASC']],
        });
        return customers.map(customer => this.mapToResponseDto(customer));
    }
    mapToResponseDto(customer) {
        return {
            id: customer.id,
            name: customer.name,
            contact: customer.contact,
            address: customer.address,
            note: customer.note,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
        };
    }
}
exports.CustomerService = CustomerService;
//# sourceMappingURL=customer.service.js.map