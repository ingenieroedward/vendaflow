import { Order, OrderAttributes } from './order.model';
import { OrderItem, OrderItemAttributes } from './order-item.model';
import { Customer } from '@/modules/customer/customer.model';
import { User } from '@/modules/user/user.model';
import { Product } from '@/modules/product/product.model';
import { 
  CreateOrderDto, 
  UpdateOrderDto, 
  OrderResponseDto, 
  OrdersListResponseDto,
  SearchOrderDto
} from './order.dto';
import { NotFoundError } from '@/core/errors/AppError';
import logger from '@/core/logger';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createOrderSchema, updateOrderSchema, searchOrderSchema } from './order.dto';
import { Op, UniqueConstraintError } from 'sequelize';
import sequelize from '@/database';
import { StockMovementService } from '@/modules/stock-movement/stock-movement.service';

export class OrderService {
  private stockMovementService = new StockMovementService();
  /**
   * Genera el siguiente número de orden en formato ORD-XX (ej: ORD-01, ORD-11).
   * Busca la última orden existente (incluyendo soft-deleted) y suma 1.
   * El contador empieza en 1. Si ocurre algún error usa el timestamp como fallback.
   */
  private async generateOrderNumber(): Promise<string> {
    try {
      // Buscar la última orden para obtener el siguiente número
      const lastOrder = await Order.findOne({
        order: [['orderNumber', 'DESC']],
        where: {

          orderNumber: {
            [Op.like]: 'ORD-%'
          }
        },
        paranoid:false
      });

      let nextNumber = 1;

      if (lastOrder) {
        const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `ORD-${nextNumber.toString().padStart(2, '0')}`;
    } catch (error) {
      logger.error('Error generating order number:', error as Error);
      // Fallback: usar timestamp como número de orden
      const timestamp = Date.now();
      return `ORD-${timestamp}`;
    }
  }

  /**
   * Crea una nueva orden con sus items.
   * Valida la existencia de cliente, usuario y todos los productos antes de persistir.
   * Los items se crean en paralelo con Promise.all (no usa transacción — si falla un item
   * la orden queda huérfana; considerar envolver en transacción si esto es crítico).
   * Si no se provee orderNumber, lo genera automáticamente.
   */
  async createOrder(orderData: CreateOrderDto, userId: number): Promise<OrderResponseDto> {
    const validatedData = validateSchema(createOrderSchema, orderData);

    // Check if customer exists
    const customer = await Customer.findByPk(validatedData.customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if all products exist
    for (const item of validatedData.items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId} not found`);
      }
    }

    // Calculate total amount
    const totalAmount = validatedData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // Create order + items inside a transaction, retrying up to 3 times on duplicate order number
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = validatedData.orderNumber ?? await this.generateOrderNumber();
      const t = await sequelize.transaction();
      try {
        const order = await Order.create({
          orderNumber,
          customerId: validatedData.customerId,
          userId,
          totalAmount,
          status: validatedData.status,
          notes: validatedData.notes,
        } as OrderAttributes, { transaction: t });

        const orderItems = await Promise.all(
          validatedData.items.map(item =>
            OrderItem.create({
              orderId: order.id,
              taxRate: item.taxRate,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            } as OrderItemAttributes, { transaction: t })
          )
        );

        // Descontar stock (permite negativo)
        for (const item of validatedData.items) {
          await this.stockMovementService.createMovement({
            productId: item.productId,
            type: 'sale',
            quantity: -item.quantity,
            referenceId: order.id,
            referenceType: 'order',
            userId,
            notes: `Orden de venta ${order.orderNumber}`,
            transaction: t,
          });
        }

        await t.commit();
        return this.mapToResponseDto(order, orderItems);
      } catch (err) {
        await t.rollback();
        // Retry only on duplicate order number; re-throw anything else immediately
        if (err instanceof UniqueConstraintError && !validatedData.orderNumber && attempt < 2) {
          logger.warn(`Order number collision on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate a unique order number after 3 attempts');
  }

  async getNextOrderNumber(): Promise<{ nextOrderNumber: string }> {
    const nextNumber = await this.generateOrderNumber();
    return { nextOrderNumber: nextNumber };
  }

  async getAllOrders(query: PaginationQuery): Promise<OrdersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Order.findAndCountAll({
      distinct: true, // prevents inflated count from 1-to-many JOIN with orderItems
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
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

  async getOrderById(id: number): Promise<OrderResponseDto> {
    const order = await Order.findOne({
      where: { id },
      include: [
        {
          model: Customer,
          as: 'customer',
        },
        {
          model: User,
          as: 'user',
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
              as: 'product',
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return this.mapToResponseDto(order, order.orderItems);
  }

  /**
   * Actualiza una orden y sincroniza sus items dentro de una transacción DB.
   * Algoritmo de sync de items:
   *  1. Elimina los items que ya no vienen en el payload.
   *  2. Actualiza los items existentes (tienen id).
   *  3. Crea los items nuevos (sin id).
   *  4. Recalcula totalAmount sumando los totalPrice actuales.
   * Si cualquier paso falla, hace rollback completo.
   */
  async updateOrder(id: number, updateData: UpdateOrderDto): Promise<OrderResponseDto> {
    const validatedData = validatePartialSchema(updateOrderSchema, updateData) as Partial<UpdateOrderDto>;

    // Start transaction
    const transaction = await sequelize.transaction();
    try {
      const order = await Order.findByPk(id, { transaction });
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Update main order fields
      await order.update(validatedData as any, { transaction });

      // If items are provided, sync them
      if (validatedData.items) {
        // Get current items
        const existingItems = await OrderItem.findAll({ where: { orderId: id }, transaction });
        const existingItemIds = existingItems.map(item => item.id);

        // IDs from update
        const updatedItemIds = validatedData.items.filter(item => !!item.id).map(item => item.id);

        // Delete removed items
        const itemsToDelete = existingItemIds.filter(itemId => !updatedItemIds.includes(itemId));
        if (itemsToDelete.length > 0) {
          await OrderItem.destroy({ where: { id: itemsToDelete }, transaction });
        }

        // Update or create items
        for (const item of validatedData.items) {
          if (
            typeof item.productId === 'number' &&
            typeof item.quantity === 'number' &&
            typeof item.unitPrice === 'number' &&
            typeof item.taxRate === 'number'
          ) {
            if (item.id && existingItemIds.includes(item.id)) {
              // Update existing
              await OrderItem.update(
                {
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: item.quantity * item.unitPrice,
                },
                { where: { id: item.id }, transaction }
              );
            } else {
              // Create new
              await OrderItem.create(
                {
                  orderId: id,
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  totalPrice: item.quantity * item.unitPrice,
                },
                { transaction }
              );
            }
          }
        }
      }

      // Recalculate totalAmount if items were updated
      if (validatedData.items) {
        const updatedItems = await OrderItem.findAll({ where: { orderId: id }, transaction });
        const totalAmount = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
        await order.update({ totalAmount }, { transaction });
      }

      await transaction.commit();

      // Fetch updated order with relations
      const updatedOrder = await Order.findOne({
        where: { id },
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'contact', 'address'],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'role'],
          },
          {
            model: OrderItem,
            as: 'orderItems',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'code', 'unit'],
              },
            ],
          },
        ],
      });

      return this.mapToResponseDto(updatedOrder!, updatedOrder!.orderItems);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteOrder(id: number): Promise<void> {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await order.destroy();
  }

  async getDeletedOrders(): Promise<OrderResponseDto[]> {
    const orders = await Order.findAll({
      where: { deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
      order: [['deletedAt', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'contact', 'address'] },
        { model: User, as: 'user', attributes: ['id', 'username', 'role'] },
      ],
    });
    return orders.map(o => this.mapToResponseDto(o, []));
  }

  async restoreOrder(id: number): Promise<OrderResponseDto> {
    const order = await Order.findOne({
      where: { id, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!order) throw new NotFoundError('Order not found in trash');
    await order.restore();
    return this.mapToResponseDto(order, []);
  }

  async hardDeleteOrder(id: number): Promise<void> {
    const order = await Order.findOne({
      where: { id, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!order) throw new NotFoundError('Order not found in trash');
    await OrderItem.destroy({ where: { orderId: id }, force: true });
    await order.destroy({ force: true });
  }

  async searchOrders(searchData: SearchOrderDto): Promise<OrderResponseDto[]> {
    const validatedData = validateSchema(searchOrderSchema, searchData) as SearchOrderDto;

    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { orderNumber: { [Op.like]: `%${validatedData.q}%` } },
        ],
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
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

  async getOrdersByCustomer(customerId: number, query: PaginationQuery): Promise<OrdersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Order.findAndCountAll({
      distinct: true,
      where: { customerId },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'contact', 'address'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Product,
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

  private mapToResponseDto(order: Order, orderItems?: OrderItem[]): OrderResponseDto {
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
      items: (orderItems || []).map(item => ({
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
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}