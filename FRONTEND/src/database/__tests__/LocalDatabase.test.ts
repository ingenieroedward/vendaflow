import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { db, SyncStatus } from '../LocalDatabase';

describe('LocalDatabase', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should open database successfully', async () => {
    expect(db.isOpen()).toBe(true);
  });

  it('should have all tables defined', () => {
    expect(db.users).toBeDefined();
    expect(db.categories).toBeDefined();
    expect(db.products).toBeDefined();
    expect(db.suppliers).toBeDefined();
    expect(db.prices).toBeDefined();
    expect(db.customers).toBeDefined();
    expect(db.orders).toBeDefined();
    expect(db.orderItems).toBeDefined();
    expect(db.syncQueue).toBeDefined();
  });

  it('should return stats', async () => {
    const stats = await db.getStats();
    expect(stats.products).toBe(0);
    expect(stats.orders).toBe(0);
    expect(stats.customers).toBe(0);
    expect(stats.suppliers).toBe(0);
    expect(stats.prices).toBe(0);
    expect(stats.pendingSync).toBe(0);
  });

  it('should reset database', async () => {
    await db.products.add({
      name: 'Test Product',
      code: 'T1',
      unit: 'pcs',
      salePrice: 100,
      _syncStatus: SyncStatus.SYNCED,
      _version: 1,
      _lastModifiedAt: Date.now()
    });

    expect(await db.products.count()).toBe(1);

    await db.resetDatabase();

    expect(await db.products.count()).toBe(0);
  });

  it('should create product with all sync fields', async () => {
    const product = {
      name: 'Test Product',
      code: 'TEST-001',
      unit: 'pcs',
      salePrice: 100,
      categoryId: 1,
      _syncStatus: SyncStatus.PENDING_CREATE,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: 1
    };

    const id = await db.products.add(product);
    const saved = await db.products.get(id);

    expect(saved).toBeDefined();
    expect(saved?.name).toBe('Test Product');
    expect(saved?._syncStatus).toBe(SyncStatus.PENDING_CREATE);
    expect(saved?._version).toBe(1);
  });

  it('should filter by sync status', async () => {
    // Crear productos con diferentes estados
    await db.products.add({
      name: 'Synced Product',
      code: 'SP-001',
      unit: 'pcs',
      salePrice: 100,
      _syncStatus: SyncStatus.SYNCED,
      _version: 1,
      _lastModifiedAt: Date.now()
    });

    await db.products.add({
      name: 'Pending Product',
      code: 'PP-001',
      unit: 'pcs',
      salePrice: 200,
      _syncStatus: SyncStatus.PENDING_CREATE,
      _version: 1,
      _lastModifiedAt: Date.now()
    });

    const pending = await db.products
      .where('_syncStatus')
      .equals(SyncStatus.PENDING_CREATE)
      .toArray();

    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('Pending Product');
  });

  it('should add to sync queue', async () => {
    const queueItem = {
      entityType: 'product' as const,
      entityLocalId: 1,
      operation: 'create' as const,
      data: { name: 'Test' },
      attempts: 0,
      createdAt: Date.now()
    };

    const id = await db.syncQueue.add(queueItem);
    const saved = await db.syncQueue.get(id);

    expect(saved).toBeDefined();
    expect(saved?.entityType).toBe('product');
    expect(saved?.operation).toBe('create');
  });
});
