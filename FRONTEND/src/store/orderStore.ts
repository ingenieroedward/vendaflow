import { create } from 'zustand';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { orderService } from '../services/orders';
import { PaginationInfo } from '../types';
import { orderRepository } from '../repositories/OrderRepository';
import { LocalOrder, LocalOrderItem } from '../database/LocalDatabase';
import { CreateOrderWithItemsDTO } from '../database/models';
import { useAuthStore } from './authStore';

// Helper to convert LocalOrder to Order (for backward compatibility)
const toOrder = (local: LocalOrder & { customer?: any; user?: any }): Order => ({
  id: local.id!,
  orderNumber: local.orderNumber,
  customerId: local.customerId,
  userId: local.userId,
  totalAmount: local.totalAmount,
  status: local.status,
  notes: local.notes || undefined,
  createdAt: local.createdAt || new Date().toISOString(),
  updatedAt: local.updatedAt || new Date().toISOString(),
  // Include relations if available
  customer: local.customer,
  user: local.user,
});

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  
  // Actions
  getOrders: (page?: number, limit?: number, filters?: OrderFilters) => Promise<void>;
  getOrderById: (id: number) => Promise<void>;
  createOrder: (data: CreateOrderRequest) => Promise<Order>;
  updateOrder: (id: number, data: UpdateOrderRequest) => Promise<Order>;
  deleteOrder: (id: number) => Promise<void>;
  clearError: () => void;
  clearCurrentOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },

  getOrders: async (page = 1, limit = 10, filters) => {
    set({ loading: true, error: null });
    try {
      // Get all orders from local DB with relations
      let localOrders = await orderRepository.getAllWithRelations();

      // Apply filters if provided
      if (filters) {
        if (filters.customerId) {
          localOrders = localOrders.filter(o => o.customerId === filters.customerId);
        }
        if (filters.status) {
          localOrders = localOrders.filter(o => o.status === filters.status);
        }
        if (filters.startDate) {
          localOrders = localOrders.filter(o =>
            o.createdAt && o.createdAt >= filters.startDate!
          );
        }
        if (filters.endDate) {
          localOrders = localOrders.filter(o =>
            o.createdAt && o.createdAt <= filters.endDate!
          );
        }
      }

      // If local DB is empty and we're online, fetch from server
      if (localOrders.length === 0 && navigator.onLine) {
        try {
          console.log('📥 Local DB empty, fetching orders from server...');
          const userId = useAuthStore.getState().user?.id;

          // Fetch from server API
          const response = await orderService.getOrders(1, 1000, filters);

          // Save to local DB
          if (response.data && response.data.length > 0) {
            console.log(`💾 Saving ${response.data.length} orders to local DB...`);

            // Import repositories
            const { customerRepository } = await import('../repositories/CustomerRepository');
            const { userRepository } = await import('../repositories/UserRepository');

            for (const serverOrder of response.data) {
              try {
                // Save customer if present
                if (serverOrder.customer) {
                  await customerRepository.saveFromServer(serverOrder.customer, userId);
                }

                // Save user if present
                if (serverOrder.user) {
                  await userRepository.saveFromServer(serverOrder.user, userId);
                }

                // Save order
                await orderRepository.saveFromServer(serverOrder, userId);
              } catch (err) {
                console.warn('Failed to save order:', serverOrder.orderNumber, err);
              }
            }

            // Re-fetch from local DB with relations
            localOrders = await orderRepository.getAllWithRelations();
            console.log(`✅ Loaded ${localOrders.length} orders from local DB`);
          }
        } catch (apiError) {
          console.warn('⚠️ Failed to fetch from server, continuing with local data:', apiError);
        }
      }

      // Apply client-side pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedOrders = localOrders.slice(startIndex, endIndex);

      const orders = paginatedOrders.map(toOrder);

      set({
        orders,
        pagination: {
          total: localOrders.length,
          page,
          limit,
          totalPages: Math.ceil(localOrders.length / limit),
        },
        loading: false,
        error: null,
      });

      // Only set error if we truly have no data
      if (localOrders.length === 0 && !navigator.onLine) {
        set({ error: 'Sin conexión. No hay órdenes disponibles offline.' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Critical error loading orders:', errorMessage);
      set({ error: errorMessage, loading: false });
    }
  },

  getOrderById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (navigator.onLine) {
        try {
          const serverOrder = await orderService.getOrderById(id);
          // Cache-on-fetch: guardar en IndexedDB
          const userId = useAuthStore.getState().user?.id;
          orderRepository.saveFromServer(serverOrder, userId).catch(() => {});
          set({ currentOrder: serverOrder, loading: false });
          return;
        } catch {
          // Si el API falla, caemos al fallback de IndexedDB
        }
      }
      // Offline (o API fallida): leer de IndexedDB
      const result = await orderRepository.getByIdWithRelations(id);
      if (!result) {
        throw new Error('Order not found');
      }
      const order = {
        ...toOrder(result.order),
        items: result.items.map(item => ({
          id: item.id!,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          totalPrice: item.totalPrice,
          taxRate: item.taxRate || 0,
          product: item.product || { id: item.productId, name: 'Desconocido', code: '-' },
        })),
      };
      set({ currentOrder: order, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  createOrder: async (data) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID
      const userId = useAuthStore.getState().user?.id;

      // Convert CreateOrderRequest to CreateOrderWithItemsDTO
      const orderData: CreateOrderWithItemsDTO = {
        order: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          totalAmount: data.totalAmount,
          status: data.status || 'pending',
          notes: data.notes
        },
        items: data.items || []
      };

      // Create order with items in local DB using repository
      const result = await orderRepository.createOrderWithItems(orderData, userId);
      const order = toOrder(result.order);

      set({ loading: false });
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID
      const userId = useAuthStore.getState().user?.id;

      // Update order with items using repository
      const result = await orderRepository.updateOrderWithItems(
        id,
        {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          status: data.status,
          notes: data.notes
        },
        data.items || [],
        userId
      );

      const order = toOrder(result.order);

      set(state => ({
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: order,
        loading: false,
      }));
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteOrder: async (id: number) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID
      const userId = useAuthStore.getState().user?.id;

      // Soft delete order and items using repository
      await orderRepository.deleteOrderWithItems(id, userId);

      set(state => ({
        orders: state.orders.filter(o => o.id !== id),
        currentOrder: state.currentOrder?.id === id ? null : state.currentOrder,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentOrder: () => set({ currentOrder: null }),
})); 