"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const order_model_1 = require("./order.model");
const order_item_model_1 = require("./order-item.model");
const customer_model_1 = require("../customer/customer.model");
const user_model_1 = require("../user/user.model");
const product_model_1 = require("../product/product.model");
const AppError_1 = require("../../core/errors/AppError");
const validation_1 = require("../../core/utils/validation");
const order_dto_1 = require("./order.dto");
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../../database"));
class OrderService {
    async generateOrderNumber() {
        try {
            // Buscar la última orden para obtener el siguiente número
            const lastOrder = await order_model_1.Order.findOne({
                order: [['orderNumber', 'DESC']],
                where: {
                    orderNumber: {
                        [sequelize_1.Op.like]: 'ORD-%'
                    }
                },
                paranoid: false
            });
            let nextNumber = 2000; // Empezar en 2000
            if (lastOrder) {
                // Extraer el número de la última orden (ej: "ORD-2005" -> 2005)
                const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
                if (match && match[1]) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }
            return `ORD-${nextNumber.toString().padStart(4, '0')}`;
        }
        catch (error) {
            console.error('Error generating order number:', error);
            // Fallback: usar timestamp como número de orden
            const timestamp = Date.now();
            return `ORD-${timestamp}`;
        }
    }
    async createOrder(orderData, userId) {
        const validatedData = (0, validation_1.validateSchema)(order_dto_1.createOrderSchema, orderData);
        // Check if customer exists
        const customer = await customer_model_1.Customer.findByPk(validatedData.customerId);
        if (!customer) {
            throw new AppError_1.NotFoundError('Customer not found');
        }
        // Check if user exists
        const user = await user_model_1.User.findByPk(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User not found');
        }
        // Check if all products exist
        for (const item of validatedData.items) {
            const product = await product_model_1.Product.findByPk(item.productId);
            if (!product) {
                throw new AppError_1.NotFoundError(`Product with ID ${item.productId} not found`);
            }
        }
        // Calculate total amount
        const totalAmount = validatedData.items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice);
        }, 0);
        // Generate order number if not provided
        let orderNumber;
        if (validatedData.orderNumber) {
            orderNumber = validatedData.orderNumber;
        }
        else {
            orderNumber = await this.generateOrderNumber();
        }
        // Create order
        const order = await order_model_1.Order.create({
            orderNumber,
            customerId: validatedData.customerId,
            userId,
            totalAmount,
            status: validatedData.status,
            notes: validatedData.notes,
        });
        // Create order items
        const orderItems = await Promise.all(validatedData.items.map(item => order_item_model_1.OrderItem.create({
            orderId: order.id,
            taxRate: item.taxRate,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
        })));
        return this.mapToResponseDto(order, orderItems);
    }
    async getNextOrderNumber() {
        const nextNumber = await this.generateOrderNumber();
        return { nextOrderNumber: nextNumber };
    }
    async getAllOrders(query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await order_model_1.Order.findAndCountAll({
            include: [
                {
                    model: customer_model_1.Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'contact', 'address'],
                },
                {
                    model: user_model_1.User,
                    as: 'user',
                    attributes: ['id', 'username', 'role'],
                },
                {
                    model: order_item_model_1.OrderItem,
                    as: 'orderItems',
                    include: [
                        {
                            model: product_model_1.Product,
                            as: 'product',
                            attributes: ['id', 'name', 'code', 'unit'],
                        },
                    ],
                },
            ],
            limit: validatedLimit,
            offset,
            order: [['createdAt', 'DESC']],
        });
        const orders = rows.map(order => this.mapToResponseDto(order, order.orderItems));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            orders,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    async getOrderById(id) {
        const order = await order_model_1.Order.findOne({
            where: { id },
            include: [
                {
                    model: customer_model_1.Customer,
                    as: 'customer',
                },
                {
                    model: user_model_1.User,
                    as: 'user',
                },
                {
                    model: order_item_model_1.OrderItem,
                    as: 'orderItems',
                    include: [
                        {
                            model: product_model_1.Product,
                            as: 'product',
                        },
                    ],
                },
            ],
        });
        if (!order) {
            throw new AppError_1.NotFoundError('Order not found');
        }
        return this.mapToResponseDto(order, order.orderItems);
    }
    async updateOrder(id, updateData) {
        const validatedData = (0, validation_1.validatePartialSchema)(order_dto_1.updateOrderSchema, updateData);
        // Start transaction
        const transaction = await database_1.default.transaction();
        try {
            const order = await order_model_1.Order.findByPk(id, { transaction });
            if (!order) {
                throw new AppError_1.NotFoundError('Order not found');
            }
            // Update main order fields
            await order.update(validatedData, { transaction });
            // If items are provided, sync them
            if (validatedData.items) {
                // Get current items
                const existingItems = await order_item_model_1.OrderItem.findAll({ where: { orderId: id }, transaction });
                const existingItemIds = existingItems.map(item => item.id);
                // IDs from update
                const updatedItemIds = validatedData.items.filter(item => !!item.id).map(item => item.id);
                // Delete removed items
                const itemsToDelete = existingItemIds.filter(itemId => !updatedItemIds.includes(itemId));
                if (itemsToDelete.length > 0) {
                    await order_item_model_1.OrderItem.destroy({ where: { id: itemsToDelete }, transaction });
                }
                // Update or create items
                for (const item of validatedData.items) {
                    if (typeof item.productId === 'number' &&
                        typeof item.quantity === 'number' &&
                        typeof item.unitPrice === 'number' &&
                        typeof item.taxRate === 'number') {
                        if (item.id && existingItemIds.includes(item.id)) {
                            // Update existing
                            await order_item_model_1.OrderItem.update({
                                productId: item.productId,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                taxRate: item.taxRate,
                                totalPrice: item.quantity * item.unitPrice,
                            }, { where: { id: item.id }, transaction });
                        }
                        else {
                            // Create new
                            await order_item_model_1.OrderItem.create({
                                orderId: id,
                                productId: item.productId,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                taxRate: item.taxRate,
                                totalPrice: item.quantity * item.unitPrice,
                            }, { transaction });
                        }
                    }
                }
            }
            // Recalculate totalAmount if items were updated
            if (validatedData.items) {
                const updatedItems = await order_item_model_1.OrderItem.findAll({ where: { orderId: id }, transaction });
                const totalAmount = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
                await order.update({ totalAmount }, { transaction });
            }
            await transaction.commit();
            // Fetch updated order with relations
            const updatedOrder = await order_model_1.Order.findOne({
                where: { id },
                include: [
                    {
                        model: customer_model_1.Customer,
                        as: 'customer',
                        attributes: ['id', 'name', 'contact', 'address'],
                    },
                    {
                        model: user_model_1.User,
                        as: 'user',
                        attributes: ['id', 'username', 'role'],
                    },
                    {
                        model: order_item_model_1.OrderItem,
                        as: 'orderItems',
                        include: [
                            {
                                model: product_model_1.Product,
                                as: 'product',
                                attributes: ['id', 'name', 'code', 'unit'],
                            },
                        ],
                    },
                ],
            });
            return this.mapToResponseDto(updatedOrder, updatedOrder.orderItems);
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async deleteOrder(id) {
        const order = await order_model_1.Order.findByPk(id);
        if (!order) {
            throw new AppError_1.NotFoundError('Order not found');
        }
        await order.destroy();
    }
    async searchOrders(searchData) {
        const validatedData = (0, validation_1.validateSchema)(order_dto_1.searchOrderSchema, searchData);
        const orders = await order_model_1.Order.findAll({
            where: {
                [sequelize_1.Op.or]: [
                    { orderNumber: { [sequelize_1.Op.like]: `%${validatedData.q}%` } },
                ],
            },
            include: [
                {
                    model: customer_model_1.Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'contact', 'address'],
                },
                {
                    model: user_model_1.User,
                    as: 'user',
                    attributes: ['id', 'username', 'role'],
                },
                {
                    model: order_item_model_1.OrderItem,
                    as: 'orderItems',
                    include: [
                        {
                            model: product_model_1.Product,
                            as: 'product',
                            attributes: ['id', 'name', 'code', 'unit'],
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
        });
        return orders.map(order => this.mapToResponseDto(order, order.orderItems));
    }
    async getOrdersByCustomer(customerId, query) {
        const { page, limit } = (0, validation_1.validateSchema)(validation_1.paginationSchema, query);
        const validatedPage = page || 1;
        const validatedLimit = limit || 10;
        const offset = (validatedPage - 1) * validatedLimit;
        const { count, rows } = await order_model_1.Order.findAndCountAll({
            where: { customerId },
            include: [
                {
                    model: customer_model_1.Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'contact', 'address'],
                },
                {
                    model: user_model_1.User,
                    as: 'user',
                    attributes: ['id', 'username', 'role'],
                },
                {
                    model: order_item_model_1.OrderItem,
                    as: 'orderItems',
                    include: [
                        {
                            model: product_model_1.Product,
                            as: 'product',
                            attributes: ['id', 'name', 'code', 'unit'],
                        },
                    ],
                },
            ],
            limit: validatedLimit,
            offset,
            order: [['createdAt', 'DESC']],
        });
        const orders = rows.map(order => this.mapToResponseDto(order, order.orderItems));
        const totalPages = Math.ceil(Number(count) / validatedLimit);
        return {
            orders,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total: Number(count),
                totalPages,
            },
        };
    }
    mapToResponseDto(order, orderItems) {
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            userId: order.userId,
            totalAmount: Number(order.totalAmount),
            status: order.status,
            notes: order.notes,
            ...(order.customer && {
                customer: {
                    id: order.customer.id,
                    name: order.customer.name,
                    contact: order.customer.contact,
                    address: order.customer.address,
                }
            }),
            ...(order.user && {
                user: {
                    id: order.user.id,
                    username: order.user.username,
                    role: order.user.role,
                }
            }),
            ...(orderItems && orderItems.length > 0 && {
                items: orderItems.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    taxRate: item.taxRate,
                    unitPrice: Number(item.unitPrice),
                    totalPrice: Number(item.totalPrice),
                    ...(item.product && {
                        product: {
                            id: item.product.id,
                            name: item.product.name,
                            code: item.product.code,
                            unit: item.product.unit,
                        }
                    }),
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                }))
            }),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        };
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map