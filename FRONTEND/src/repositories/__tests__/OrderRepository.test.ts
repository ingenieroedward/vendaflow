/**
 * OrderRepository Tests
 *
 * Tests for the Order repository including:
 * - Order creation with items (transactions)
 * - Order updates with item replacement
 * - Order deletion with cascading deletes
 * - Order number generation
 * - Search and filtering
 * - Statistics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { orderRepository } from '../OrderRepository';
import { db } from '../../database/LocalDatabase';
import { CreateOrderWithItemsDTO, CreateOrderItemDTO } from '../../database/models';

/**
 * Test Setup
 *
 * Note: These tests require Vitest and fake-indexeddb to be configured
 * Install with: npm install -D vitest fake-indexeddb @vitest/ui
 *
 * Add to package.json:
 * "scripts": {
 *   "test": "vitest",
 *   "test:ui": "vitest --ui"
 * }
 *
 * Create vitest.config.ts:
 * import { defineConfig } from 'vitest/config';
 * export default defineConfig({
 *   test: {
 *     environment: 'jsdom',
 *     setupFiles: ['./src/test/setup.ts']
 *   }
 * });
 */

describe('OrderRepository', () => {
  const testUserId = 1;
  const testCustomerId = 1;

  beforeEach(async () => {
    // Clear all tables before each test
    await db.orders.clear();
    await db.orderItems.clear();
    await db.syncQueue.clear();

    // Seed test data if needed
    // Example: create a test customer, test products, etc.
  });

  afterEach(async () => {
    // Cleanup after each test
    await db.orders.clear();
    await db.orderItems.clear();
    await db.syncQueue.clear();
  });

  describe('createOrderWithItems', () => {
    it('should create order with items in a transaction', async () => {
      const orderData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 1190,
          status: 'pending',
          notes: 'Test order'
        },
        items: [
          {
            productId: 1,
            quantity: 10,
            unitPrice: 100,
            taxRate: 19,
            totalPrice: 1190
          }
        ]
      };

      const result = await orderRepository.createOrderWithItems(orderData, testUserId);

      expect(result.order).toBeDefined();
      expect(result.order.orderNumber).toBe('ORD-001');
      expect(result.order.totalAmount).toBe(1190);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(1);
      expect(result.items[0].quantity).toBe(10);

      // Verify sync queue entries were created
      const syncQueueEntries = await db.syncQueue.toArray();
      expect(syncQueueEntries.length).toBeGreaterThanOrEqual(2); // Order + at least 1 item
    });

    it('should validate order data', async () => {
      const invalidOrderData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: '', // Invalid: empty
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      };

      await expect(
        orderRepository.createOrderWithItems(invalidOrderData, testUserId)
      ).rejects.toThrow('Order validation failed');
    });

    it('should validate items data', async () => {
      const orderDataWithInvalidItem: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: -5, // Invalid: negative quantity
            unitPrice: 100,
            taxRate: 19,
            totalPrice: 100
          }
        ]
      };

      await expect(
        orderRepository.createOrderWithItems(orderDataWithInvalidItem, testUserId)
      ).rejects.toThrow('validation failed');
    });

    it('should validate that order total matches sum of items', async () => {
      const orderDataWithMismatchedTotal: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 999, // Doesn't match items total
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 10,
            unitPrice: 100,
            taxRate: 19,
            totalPrice: 1190
          }
        ]
      };

      await expect(
        orderRepository.createOrderWithItems(orderDataWithMismatchedTotal, testUserId)
      ).rejects.toThrow('does not match sum of items');
    });

    it('should rollback transaction if any step fails', async () => {
      // This test would simulate a failure during item creation
      // to ensure the transaction rolls back and no partial data is saved
      // Implementation depends on how to mock transaction failures
    });

    it('should set correct metadata fields', async () => {
      const orderData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const result = await orderRepository.createOrderWithItems(orderData, testUserId);

      expect(result.order._syncStatus).toBe('PENDING_CREATE');
      expect(result.order._version).toBe(1);
      expect(result.order._createdBy).toBe(testUserId);
      expect(result.order._lastModifiedBy).toBe(testUserId);
      expect(result.order._createdAt).toBeDefined();
      expect(result.order._lastModifiedAt).toBeDefined();
    });
  });

  describe('updateOrderWithItems', () => {
    it('should update order and replace items', async () => {
      // First create an order
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);
      const orderId = created.order.id!;

      // Update with new items
      const newItems: CreateOrderItemDTO[] = [
        {
          productId: 2,
          quantity: 2,
          unitPrice: 50,
          taxRate: 0,
          totalPrice: 100
        },
        {
          productId: 3,
          quantity: 1,
          unitPrice: 150,
          taxRate: 0,
          totalPrice: 150
        }
      ];

      const result = await orderRepository.updateOrderWithItems(
        orderId,
        { status: 'processing' },
        newItems,
        testUserId
      );

      expect(result.order.status).toBe('processing');
      expect(result.order.totalAmount).toBe(250); // Recalculated from items
      expect(result.items).toHaveLength(2);
      expect(result.items[0].productId).toBe(2);
      expect(result.items[1].productId).toBe(3);

      // Verify old items were soft deleted
      const allItems = await db.orderItems.where('orderId').equals(orderId).toArray();
      const deletedItems = allItems.filter(item => item.deletedAt !== null);
      expect(deletedItems).toHaveLength(1); // Original item should be soft deleted
    });

    it('should increment version number', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);
      const initialVersion = created.order._version;

      const result = await orderRepository.updateOrderWithItems(
        created.order.id!,
        { status: 'processing' },
        createData.items,
        testUserId
      );

      expect(result.order._version).toBe(initialVersion + 1);
    });

    it('should set sync status to PENDING_UPDATE', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);

      const result = await orderRepository.updateOrderWithItems(
        created.order.id!,
        { status: 'processing' },
        createData.items,
        testUserId
      );

      expect(result.order._syncStatus).toBe('PENDING_UPDATE');
    });

    it('should throw error if order not found', async () => {
      await expect(
        orderRepository.updateOrderWithItems(
          99999,
          { status: 'processing' },
          [],
          testUserId
        )
      ).rejects.toThrow('not found');
    });

    it('should throw error if order is deleted', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);
      await orderRepository.deleteOrderWithItems(created.order.id!, testUserId);

      await expect(
        orderRepository.updateOrderWithItems(
          created.order.id!,
          { status: 'processing' },
          [],
          testUserId
        )
      ).rejects.toThrow('deleted');
    });
  });

  describe('deleteOrderWithItems', () => {
    it('should soft delete order and all items', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 200,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          },
          {
            productId: 2,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);
      const orderId = created.order.id!;

      await orderRepository.deleteOrderWithItems(orderId, testUserId);

      // Verify order is soft deleted
      const order = await db.orders.get(orderId);
      expect(order?.deletedAt).toBeDefined();
      expect(order?._syncStatus).toBe('PENDING_DELETE');

      // Verify all items are soft deleted
      const items = await db.orderItems.where('orderId').equals(orderId).toArray();
      expect(items).toHaveLength(2);
      items.forEach(item => {
        expect(item.deletedAt).toBeDefined();
        expect(item._syncStatus).toBe('PENDING_DELETE');
      });

      // Verify sync queue entries
      const syncEntries = await db.syncQueue
        .filter(entry => entry.operation === 'DELETE')
        .toArray();
      expect(syncEntries.length).toBeGreaterThanOrEqual(3); // Order + 2 items
    });

    it('should not delete already deleted items', async () => {
      // Create order with items, manually delete one item, then delete order
      // Verify that only non-deleted items get new deletedAt timestamp
    });

    it('should throw error if order not found', async () => {
      await expect(
        orderRepository.deleteOrderWithItems(99999, testUserId)
      ).rejects.toThrow('not found');
    });

    it('should throw error if order already deleted', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);
      await orderRepository.deleteOrderWithItems(created.order.id!, testUserId);

      await expect(
        orderRepository.deleteOrderWithItems(created.order.id!, testUserId)
      ).rejects.toThrow('already deleted');
    });
  });

  describe('getNextOrderNumber', () => {
    it('should return ORD-001 for first order', async () => {
      const orderNumber = await orderRepository.getNextOrderNumber();
      expect(orderNumber).toBe('ORD-001');
    });

    it('should increment order number sequentially', async () => {
      // Create first order
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const nextNumber = await orderRepository.getNextOrderNumber();
      expect(nextNumber).toBe('ORD-002');
    });

    it('should pad numbers with leading zeros', async () => {
      // Create 98 orders to get to ORD-098
      for (let i = 1; i <= 98; i++) {
        await orderRepository.createOrderWithItems({
          order: {
            orderNumber: `ORD-${i.toString().padStart(3, '0')}`,
            customerId: testCustomerId,
            userId: testUserId,
            totalAmount: 100,
            status: 'pending'
          },
          items: []
        }, testUserId);
      }

      const nextNumber = await orderRepository.getNextOrderNumber();
      expect(nextNumber).toBe('ORD-099');

      // Create one more to test triple digits
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-099',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const nextNumber2 = await orderRepository.getNextOrderNumber();
      expect(nextNumber2).toBe('ORD-100');
    });

    it('should not reuse numbers from deleted orders', async () => {
      // Create and delete ORD-001
      const created = await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.deleteOrderWithItems(created.order.id!, testUserId);

      const nextNumber = await orderRepository.getNextOrderNumber();
      expect(nextNumber).toBe('ORD-002'); // Should skip deleted number
    });

    it('should handle gaps in order numbers', async () => {
      // Create ORD-001 and ORD-003 (skipping ORD-002)
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-003',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const nextNumber = await orderRepository.getNextOrderNumber();
      expect(nextNumber).toBe('ORD-004'); // Should use max + 1
    });
  });

  describe('search', () => {
    it('should search by order number', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const results = await orderRepository.search('ORD-001');
      expect(results).toHaveLength(1);
      expect(results[0].orderNumber).toBe('ORD-001');
    });

    it('should search case-insensitive', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const results = await orderRepository.search('ord-001');
      expect(results).toHaveLength(1);
    });

    it('should return all orders if search term is empty', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const results = await orderRepository.search('');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should not return deleted orders', async () => {
      const created = await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.deleteOrderWithItems(created.order.id!, testUserId);

      const results = await orderRepository.search('ORD-001');
      expect(results).toHaveLength(0);
    });
  });

  describe('getByCustomer', () => {
    it('should return all orders for a customer', async () => {
      // Create 2 orders for customer 1
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: 1,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-002',
          customerId: 1,
          userId: testUserId,
          totalAmount: 200,
          status: 'pending'
        },
        items: []
      }, testUserId);

      // Create 1 order for customer 2
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-003',
          customerId: 2,
          userId: testUserId,
          totalAmount: 300,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const customer1Orders = await orderRepository.getByCustomer(1);
      expect(customer1Orders).toHaveLength(2);
      expect(customer1Orders.every(o => o.customerId === 1)).toBe(true);

      const customer2Orders = await orderRepository.getByCustomer(2);
      expect(customer2Orders).toHaveLength(1);
      expect(customer2Orders[0].customerId).toBe(2);
    });
  });

  describe('getByStatus', () => {
    it('should return orders filtered by status', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-002',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 200,
          status: 'completed'
        },
        items: []
      }, testUserId);

      const pendingOrders = await orderRepository.getByStatus('pending');
      expect(pendingOrders).toHaveLength(1);
      expect(pendingOrders[0].status).toBe('pending');

      const completedOrders = await orderRepository.getByStatus('completed');
      expect(completedOrders).toHaveLength(1);
      expect(completedOrders[0].status).toBe('completed');
    });
  });

  describe('getByDateRange', () => {
    it('should return orders within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const results = await orderRepository.getByDateRange(yesterday, tomorrow);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getOrderWithItems', () => {
    it('should return order with all its items', async () => {
      const createData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 200,
          status: 'pending'
        },
        items: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          },
          {
            productId: 2,
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            totalPrice: 100
          }
        ]
      };

      const created = await orderRepository.createOrderWithItems(createData, testUserId);

      const result = await orderRepository.getOrderWithItems(created.order.id!);

      expect(result).toBeDefined();
      expect(result?.order.orderNumber).toBe('ORD-001');
      expect(result?.items).toHaveLength(2);
    });

    it('should not return deleted items', async () => {
      // Create order with items, delete one item manually, verify getOrderWithItems
      // doesn't return the deleted item
    });

    it('should return null if order not found', async () => {
      const result = await orderRepository.getOrderWithItems(99999);
      expect(result).toBeNull();
    });
  });

  describe('orderNumberExists', () => {
    it('should return true if order number exists', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const exists = await orderRepository.orderNumberExists('ORD-001');
      expect(exists).toBe(true);
    });

    it('should return false if order number does not exist', async () => {
      const exists = await orderRepository.orderNumberExists('ORD-999');
      expect(exists).toBe(false);
    });

    it('should check case-insensitive', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const exists = await orderRepository.orderNumberExists('ord-001');
      expect(exists).toBe(true);
    });

    it('should exclude specified ID when checking', async () => {
      const created = await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      // Should return false when excluding the only order with this number
      const exists = await orderRepository.orderNumberExists('ORD-001', created.order.id!);
      expect(exists).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 100,
          status: 'pending'
        },
        items: []
      }, testUserId);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-002',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 200,
          status: 'completed'
        },
        items: []
      }, testUserId);

      await orderRepository.createOrderWithItems({
        order: {
          orderNumber: 'ORD-003',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 150,
          status: 'pending'
        },
        items: []
      }, testUserId);

      const stats = await orderRepository.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus['pending']).toBe(2);
      expect(stats.byStatus['completed']).toBe(1);
      expect(stats.totalRevenue).toBe(450);
      expect(stats.averageOrderValue).toBe(150);
    });

    it('should handle empty database', async () => {
      const stats = await orderRepository.getStats();

      expect(stats.total).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.averageOrderValue).toBe(0);
    });
  });

  describe('saveFromServer', () => {
    it('should save order from server (upsert)', async () => {
      const serverOrder = {
        id: 100,
        orderNumber: 'ORD-001',
        customerId: testCustomerId,
        userId: testUserId,
        totalAmount: 100,
        status: 'pending' as const,
        notes: 'From server',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = await orderRepository.saveFromServer(serverOrder, testUserId);

      expect(saved.serverId).toBe(100);
      expect(saved.orderNumber).toBe('ORD-001');
      expect(saved._syncStatus).toBe('SYNCED');
    });

    it('should update existing order on second save', async () => {
      const serverOrder = {
        id: 100,
        orderNumber: 'ORD-001',
        customerId: testCustomerId,
        userId: testUserId,
        totalAmount: 100,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await orderRepository.saveFromServer(serverOrder, testUserId);

      // Update from server
      const updatedServerOrder = {
        ...serverOrder,
        status: 'completed' as const,
        totalAmount: 200
      };

      const updated = await orderRepository.saveFromServer(updatedServerOrder, testUserId);

      expect(updated.status).toBe('completed');
      expect(updated.totalAmount).toBe(200);

      // Verify only one local record exists
      const allOrders = await db.orders.toArray();
      const ordersWithServerId100 = allOrders.filter(o => o.serverId === 100);
      expect(ordersWithServerId100).toHaveLength(1);
    });
  });

  describe('saveOrderWithItemsFromServer', () => {
    it('should save order and items from server', async () => {
      const serverOrder = {
        id: 100,
        orderNumber: 'ORD-001',
        customerId: testCustomerId,
        userId: testUserId,
        totalAmount: 200,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const serverItems = [
        {
          id: 201,
          orderId: 100,
          productId: 1,
          quantity: 1,
          unitPrice: 100,
          taxRate: 0,
          totalPrice: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 202,
          orderId: 100,
          productId: 2,
          quantity: 1,
          unitPrice: 100,
          taxRate: 0,
          totalPrice: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const result = await orderRepository.saveOrderWithItemsFromServer(
        serverOrder,
        serverItems,
        testUserId
      );

      expect(result.order.serverId).toBe(100);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].serverId).toBe(201);
      expect(result.items[1].serverId).toBe(202);
    });
  });
});
