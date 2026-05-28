import { BaseRepository } from './BaseRepository';
import { db, LocalOrder, LocalOrderItem, SyncStatus } from '../database/LocalDatabase';
import {
  ServerOrder,
  ServerOrderItem,
  CreateOrderDTO,
  CreateOrderItemDTO,
  CreateOrderWithItemsDTO,
  OrderValidation,
  OrderItemValidation,
  OrderCalculations,
  OrderTransform,
  OrderItemTransform
} from '../database/models';
import { createBaseModel } from '../database/schemas';

/**
 * Repository for Order entities
 * Handles orders with their items in transactions
 */
export class OrderRepository extends BaseRepository<
  LocalOrder,
  ServerOrder,
  CreateOrderDTO
> {
  constructor() {
    super(db.orders, 'Order');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerOrder, userId?: number): Omit<LocalOrder, 'id'> {
    return OrderTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalOrder): Partial<ServerOrder> {
    return OrderTransform.toServer(localData);
  }

  protected validate(data: CreateOrderDTO): { valid: boolean; errors: string[] } {
    return OrderValidation.validate(data);
  }

  // Order-specific methods

  /**
   * Search orders by order number or customer name
   */
  async search(searchTerm: string): Promise<LocalOrder[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(order =>
        !order.deletedAt &&
        (order.orderNumber.toLowerCase().includes(term))
      )
      .toArray();
  }

  /**
   * Get orders by customer
   */
  async getByCustomer(customerId: number): Promise<LocalOrder[]> {
    return await this.table
      .where('customerId')
      .equals(customerId)
      .filter(order => !order.deletedAt)
      .toArray();
  }

  /**
   * Get orders by status
   */
  async getByStatus(status: string): Promise<LocalOrder[]> {
    return await this.table
      .where('status')
      .equals(status)
      .filter(order => !order.deletedAt)
      .toArray();
  }

  /**
   * Get orders within date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<LocalOrder[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    return await this.table
      .filter(order =>
        !order.deletedAt &&
        order.createdAt &&
        order.createdAt >= start &&
        order.createdAt <= end
      )
      .toArray();
  }

  /**
   * Get next available order number
   * Format: ORD-001, ORD-002, etc.
   */
  async getNextOrderNumber(): Promise<string> {
    const allOrders = await db.orders.toArray();

    const numbers = allOrders
      .map(order => {
        const match = order.orderNumber.match(/ORD-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    // También considerar el máximo del servidor guardado en seed
    // para que limpiar datos locales no reinicie la numeración a ORD-001
    const serverMax = parseInt(localStorage.getItem('serverMaxOrderNumber') ?? '0', 10);

    const maxNumber = Math.max(...numbers, serverMax, 0);
    const nextNumber = maxNumber + 1;
    return `ORD-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Check if order number already exists
   */
  async orderNumberExists(orderNumber: string, excludeId?: number): Promise<boolean> {
    const orders = await this.table
      .filter(order =>
        order.orderNumber.toLowerCase() === orderNumber.toLowerCase() &&
        (!excludeId || order.id !== excludeId)
      )
      .toArray();

    return orders.length > 0;
  }

  /**
   * Get order with all its items
   */
  async getOrderWithItems(orderId: number): Promise<{
    order: LocalOrder;
    items: LocalOrderItem[];
  } | null> {
    const order = await this.getById(orderId);
    if (!order) {
      return null;
    }

    const items = await db.orderItems
      .where('orderId')
      .equals(orderId)
      .filter(item => !item.deletedAt)
      .toArray();

    return {
      order,
      items
    };
  }

  /**
   * Create order with items in a transaction
   * Validates totals and ensures atomicity
   */
  async createOrderWithItems(
    data: CreateOrderWithItemsDTO,
    userId?: number
  ): Promise<{ order: LocalOrder; items: LocalOrderItem[] }> {
    // Validate order
    const orderValidation = OrderValidation.validate(data.order);
    if (!orderValidation.valid) {
      throw new Error(`Order validation failed: ${orderValidation.errors.join(', ')}`);
    }

    // Validate all items
    for (let i = 0; i < data.items.length; i++) {
      const itemValidation = OrderItemValidation.validate(data.items[i]);
      if (!itemValidation.valid) {
        throw new Error(`Item ${i + 1} validation failed: ${itemValidation.errors.join(', ')}`);
      }
    }

    // Validate that totalAmount matches sum of items
    const calculatedTotal = OrderCalculations.calculateOrderTotal(data.items);
    if (!OrderCalculations.validateOrderTotal(data.order.totalAmount, data.items)) {
      throw new Error(
        `Order total (${data.order.totalAmount}) does not match sum of items (${calculatedTotal})`
      );
    }

    // Create in transaction
    return await db.transaction('rw', [db.orders, db.orderItems, db.syncQueue], async () => {
      // Create order
      const orderWithMeta = {
        ...data.order,
        ...createBaseModel(userId)
      } as Omit<LocalOrder, 'id'>;

      const orderId = await db.orders.add(orderWithMeta as LocalOrder);

      // Add to sync queue
      await this.addToSyncQueue('CREATE', orderId);

      // Create items
      const itemsToCreate = data.items.map(item => ({
        ...item,
        orderId,
        ...createBaseModel(userId)
      })) as Omit<LocalOrderItem, 'id'>[];

      await db.orderItems.bulkAdd(itemsToCreate as LocalOrderItem[]);

      // Add items to sync queue (each item as a separate queue entry)
      for (const item of itemsToCreate) {
        const itemId = await db.orderItems
          .where({ orderId, productId: item.productId })
          .first()
          .then(i => i?.id);

        if (itemId) {
          await db.syncQueue.add({
            entityType: 'OrderItem',
            entityId: itemId,
            operation: 'CREATE',
            createdAt: new Date().toISOString(),
            retries: 0
          } as any);
        }
      }

      // Fetch created order and items
      const createdOrder = await db.orders.get(orderId);
      const createdItems = await db.orderItems.where('orderId').equals(orderId).toArray();

      if (!createdOrder) {
        throw new Error('Failed to retrieve created order');
      }

      return {
        order: createdOrder,
        items: createdItems
      };
    });
  }

  /**
   * Update order with items
   * Handles adding, updating, and removing items
   */
  async updateOrderWithItems(
    orderId: number,
    orderUpdates: Partial<CreateOrderDTO>,
    items: CreateOrderItemDTO[],
    userId?: number
  ): Promise<{ order: LocalOrder; items: LocalOrderItem[] }> {
    const existing = await this.getById(orderId);
    if (!existing) {
      throw new Error(`Order not found with id ${orderId}`);
    }

    if (existing.deletedAt) {
      throw new Error('Order is deleted');
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const itemValidation = OrderItemValidation.validate(items[i]);
      if (!itemValidation.valid) {
        throw new Error(`Item ${i + 1} validation failed: ${itemValidation.errors.join(', ')}`);
      }
    }

    // Calculate new total from items
    const calculatedTotal = OrderCalculations.calculateOrderTotal(items);

    // Update in transaction
    return await db.transaction('rw', [db.orders, db.orderItems, db.syncQueue], async () => {
      // Update order
      const orderUpdateData: Partial<LocalOrder> = {
        ...orderUpdates,
        totalAmount: calculatedTotal, // Always recalculate from items
        _syncStatus: SyncStatus.PENDING_UPDATE,
        _version: existing._version + 1,
        _lastModifiedAt: Date.now(),
        _lastModifiedBy: userId
      } as Partial<LocalOrder>;

      await db.orders.update(orderId, orderUpdateData);
      await this.addToSyncQueue('UPDATE', orderId);

      // Get existing items
      const existingItems = await db.orderItems.where('orderId').equals(orderId).toArray();

      // Delete all existing items (soft delete)
      for (const existingItem of existingItems) {
        if (existingItem.id) {
          await db.orderItems.update(existingItem.id, {
            deletedAt: new Date().toISOString(),
            _syncStatus: SyncStatus.PENDING_DELETE,
            _lastModifiedAt: Date.now(),
            _lastModifiedBy: userId
          });

          await db.syncQueue.add({
            entityType: 'OrderItem',
            entityId: existingItem.id,
            operation: 'DELETE',
            createdAt: new Date().toISOString(),
            retries: 0
          } as any);
        }
      }

      // Create new items
      const newItems = items.map(item => ({
        ...item,
        orderId,
        ...createBaseModel(userId)
      })) as Omit<LocalOrderItem, 'id'>[];

      await db.orderItems.bulkAdd(newItems as LocalOrderItem[]);

      // Add new items to sync queue
      const createdItems = await db.orderItems
        .where('orderId')
        .equals(orderId)
        .filter(item => !item.deletedAt)
        .toArray();

      for (const item of createdItems) {
        if (item.id) {
          await db.syncQueue.add({
            entityType: 'OrderItem',
            entityId: item.id,
            operation: 'CREATE',
            createdAt: new Date().toISOString(),
            retries: 0
          } as any);
        }
      }

      // Fetch updated order and items
      const updatedOrder = await db.orders.get(orderId);
      const updatedItems = await db.orderItems
        .where('orderId')
        .equals(orderId)
        .filter(item => !item.deletedAt)
        .toArray();

      if (!updatedOrder) {
        throw new Error('Failed to retrieve updated order');
      }

      return {
        order: updatedOrder,
        items: updatedItems
      };
    });
  }

  /**
   * Delete order (soft delete order and all its items)
   */
  async deleteOrderWithItems(orderId: number, userId?: number): Promise<void> {
    const existing = await this.getById(orderId);
    if (!existing) {
      throw new Error(`Order not found with id ${orderId}`);
    }

    if (existing.deletedAt) {
      throw new Error('Order is already deleted');
    }

    // Delete in transaction
    await db.transaction('rw', [db.orders, db.orderItems, db.syncQueue], async () => {
      // Soft delete order
      await db.orders.update(orderId, {
        deletedAt: new Date().toISOString(),
        _syncStatus: SyncStatus.PENDING_DELETE,
        _lastModifiedAt: Date.now(),
        _lastModifiedBy: userId
      });

      await this.addToSyncQueue('DELETE', orderId);

      // Soft delete all items
      const items = await db.orderItems.where('orderId').equals(orderId).toArray();

      for (const item of items) {
        if (item.id && !item.deletedAt) {
          await db.orderItems.update(item.id, {
            deletedAt: new Date().toISOString(),
            _syncStatus: SyncStatus.PENDING_DELETE,
            _lastModifiedAt: Date.now(),
            _lastModifiedBy: userId
          });

          await db.syncQueue.add({
            entityType: 'OrderItem',
            entityId: item.id,
            operation: 'DELETE',
            createdAt: new Date().toISOString(),
            retries: 0
          } as any);
        }
      }
    });
  }

  /**
   * Save order with items from server
   */
  async saveOrderWithItemsFromServer(
    serverOrder: ServerOrder,
    serverItems: ServerOrderItem[],
    userId?: number
  ): Promise<{ order: LocalOrder; items: LocalOrderItem[] }> {
    return await db.transaction('rw', [db.orders, db.orderItems], async () => {
      // Save order
      const localOrder = await this.saveFromServer(serverOrder, userId);

      // Save items
      const localItems: LocalOrderItem[] = [];

      for (const serverItem of serverItems) {
        const localItemData = OrderItemTransform.fromServer(serverItem, userId);

        // Check if item exists by serverId
        if (localItemData.serverId) {
          const existing = await db.orderItems
            .where('serverId')
            .equals(localItemData.serverId)
            .first();

          if (existing) {
            // Update existing
            await db.orderItems.update(existing.id!, localItemData as Partial<LocalOrderItem>);
            const updated = await db.orderItems.get(existing.id!);
            if (updated) localItems.push(updated);
          } else {
            // Insert new
            const id = await db.orderItems.add(localItemData as LocalOrderItem);
            const created = await db.orderItems.get(id);
            if (created) localItems.push(created);
          }
        }
      }

      return {
        order: localOrder,
        items: localItems
      };
    });
  }

  /**
   * Get all orders with their relations (customer, user)
   * Populates customer and user from their respective tables
   */
  async getAllWithRelations(): Promise<Array<LocalOrder & {
    customer?: any;
    user?: any;
  }>> {
    const orders = await this.getAll();

    // Populate relations
    const ordersWithRelations = await Promise.all(
      orders.map(async (order) => {
        const customer = await db.customers.get(order.customerId);
        const user = await db.users.get(order.userId);

        return {
          ...order,
          customer,
          user
        };
      })
    );

    return ordersWithRelations;
  }

  /**
   * Get order by ID with relations (customer, user, items)
   */
  async getByIdWithRelations(id: number): Promise<{
    order: LocalOrder & { customer?: any; user?: any };
    items: Array<LocalOrderItem & { product?: any }>;
  } | null> {
    const order = await this.getById(id);
    if (!order) {
      return null;
    }

    // Get customer and user
    const customer = await db.customers.get(order.customerId);
    const user = await db.users.get(order.userId);

    // Get items with products
    const items = await db.orderItems
      .where('orderId')
      .equals(id)
      .filter(item => !item.deletedAt)
      .toArray();

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await db.products.get(item.productId);
        return {
          ...item,
          product
        };
      })
    );

    return {
      order: {
        ...order,
        customer,
        user
      },
      items: itemsWithProducts
    };
  }

  /**
   * Get statistics about orders
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    const allOrders = await this.getAll();

    const stats = {
      total: allOrders.length,
      byStatus: {} as Record<string, number>,
      totalRevenue: 0,
      averageOrderValue: 0
    };

    for (const order of allOrders) {
      // Count by status
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;

      // Calculate revenue
      stats.totalRevenue += order.totalAmount;
    }

    // Calculate average
    stats.averageOrderValue = stats.total > 0
      ? Math.round((stats.totalRevenue / stats.total) * 100) / 100
      : 0;

    return stats;
  }
}

// Export singleton instance
export const orderRepository = new OrderRepository();
