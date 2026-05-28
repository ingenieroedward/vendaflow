import Dexie, { Table } from 'dexie';

// Interfaces de sincronización
export enum SyncStatus {
  SYNCED = 'synced',
  PENDING_CREATE = 'pending_create',
  PENDING_UPDATE = 'pending_update',
  PENDING_DELETE = 'pending_delete',
  CONFLICT = 'conflict'
}

// Base interface para todos los modelos locales
export interface BaseLocalModel {
  id?: number; // ID local (auto-increment)
  serverId?: number; // ID del servidor (cuando existe)
  _syncStatus: SyncStatus;
  _version: number; // Version para conflict resolution
  _lastModifiedAt: number; // Timestamp local
  _lastModifiedBy?: number; // User ID que modificó
  createdAt?: string; // ISO string del servidor
  updatedAt?: string; // ISO string del servidor
  deletedAt?: string | null; // Soft delete
}

// Interfaces de modelos locales
export interface LocalUser extends BaseLocalModel {
  username: string;
  role: 'buyer' | 'seller' | 'admin';
}

export interface LocalCategory extends BaseLocalModel {
  name: string;
}

export interface LocalProduct extends BaseLocalModel {
  name: string;
  code: string;
  unit: string;
  salePrice: number;
  categoryId?: number;
}

export interface LocalSupplier extends BaseLocalModel {
  name: string;
  contact: string;
  location: string;
}

export interface LocalPrice extends BaseLocalModel {
  productId: number;
  supplierId: number;
  price: number;
  updatedByUserId: number;
}

export interface LocalCustomer extends BaseLocalModel {
  code?: string | null;
  name: string;
  nit?: string | null;
  contact: string;
  address: string;
  note?: string;
}

export interface LocalOrder extends BaseLocalModel {
  orderNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
}

export interface LocalOrderItem extends BaseLocalModel {
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalPrice: number;
}

// Queue de operaciones pendientes
export interface SyncQueueItem {
  id?: number;
  entityType: 'product' | 'order' | 'order_item' | 'customer' | 'supplier' | 'price';
  entityLocalId: number;
  operation: 'create' | 'update' | 'delete';
  data: any;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
}

// Clase principal de la base de datos
class LocalDatabase extends Dexie {
  // Tablas
  users!: Table<LocalUser, number>;
  categories!: Table<LocalCategory, number>;
  products!: Table<LocalProduct, number>;
  suppliers!: Table<LocalSupplier, number>;
  prices!: Table<LocalPrice, number>;
  customers!: Table<LocalCustomer, number>;
  orders!: Table<LocalOrder, number>;
  orderItems!: Table<LocalOrderItem, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('JJLM_Database');

    // Version 1: Schema inicial
    this.version(1).stores({
      users: '++id, serverId, username, _syncStatus, _lastModifiedAt',
      categories: '++id, serverId, name, _syncStatus, _lastModifiedAt',
      products: '++id, serverId, code, name, categoryId, _syncStatus, _lastModifiedAt',
      suppliers: '++id, serverId, name, _syncStatus, _lastModifiedAt',
      prices: '++id, serverId, [productId+supplierId], productId, supplierId, _syncStatus, _lastModifiedAt',
      customers: '++id, serverId, name, _syncStatus, _lastModifiedAt',
      orders: '++id, serverId, orderNumber, customerId, userId, status, _syncStatus, _lastModifiedAt',
      orderItems: '++id, serverId, orderId, productId, _syncStatus, _lastModifiedAt',
      syncQueue: '++id, entityType, entityLocalId, createdAt, attempts'
    });

    // Version 2: nit index en customers
    this.version(2).stores({
      customers: '++id, serverId, name, nit, _syncStatus, _lastModifiedAt',
    });

    // Version 3: code index en customers
    this.version(3).stores({
      customers: '++id, serverId, code, name, nit, _syncStatus, _lastModifiedAt',
    });

    // Hooks globales
    this.on('ready', () => {
      console.log('📦 LocalDatabase initialized successfully');
    });
  }

  // Método helper para resetear la DB (solo desarrollo)
  async resetDatabase(): Promise<void> {
    await this.delete();
    await this.open();
    console.log('🔄 Database reset complete');
  }

  // Método helper para obtener estadísticas
  async getStats() {
    const stats = {
      products: await this.products.count(),
      orders: await this.orders.count(),
      customers: await this.customers.count(),
      suppliers: await this.suppliers.count(),
      prices: await this.prices.count(),
      pendingSync: await this.syncQueue.count(),
      unsyncedProducts: await this.products.where('_syncStatus').notEqual('synced').count(),
      unsyncedOrders: await this.orders.where('_syncStatus').notEqual('synced').count()
    };
    return stats;
  }
}

// Singleton instance
export const db = new LocalDatabase();

// Export para uso en tests
export default db;
