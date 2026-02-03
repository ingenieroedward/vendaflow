import 'fake-indexeddb/auto';
import { db, SyncStatus } from '../../database/LocalDatabase';
import { ProductRepository } from '../ProductRepository';
import { ServerProduct, CreateProductDTO } from '../../database/models';

describe('ProductRepository', () => {
  let repository: ProductRepository;

  beforeEach(async () => {
    // Reset database before each test
    await db.delete();
    await db.open();
    repository = new ProductRepository();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('createLocal', () => {
    it('should create a product locally with sync metadata', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-001',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.code).toBe('TEST-001');
      expect(product._syncStatus).toBe(SyncStatus.PENDING_CREATE);
      expect(product._version).toBe(1);
      expect(product._lastModifiedBy).toBe(1);
    });

    it('should add product to sync queue', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-002',
        unit: 'pcs',
        salePrice: 50.00,
      };

      await repository.createLocal(productData, 1);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].entityType).toBe('Product');
      expect(queueItems[0].operation).toBe('CREATE');
    });

    it('should throw error if validation fails', async () => {
      const invalidData: CreateProductDTO = {
        name: 'AB', // Too short (min 3 characters)
        code: 'TEST-003',
        unit: 'pcs',
        salePrice: 100.00,
      };

      await expect(repository.createLocal(invalidData, 1)).rejects.toThrow('Validation failed');
    });
  });

  describe('updateLocal', () => {
    it('should update a product and increment version', async () => {
      // Create product first
      const productData: CreateProductDTO = {
        name: 'Original Product',
        code: 'ORIG-001',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Update product
      const updated = await repository.updateLocal(
        product.id!,
        { name: 'Updated Product' },
        2
      );

      expect(updated.name).toBe('Updated Product');
      expect(updated._version).toBe(2); // Version incremented
      expect(updated._syncStatus).toBe(SyncStatus.PENDING_UPDATE);
      expect(updated._lastModifiedBy).toBe(2);
    });

    it('should add update operation to sync queue', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-004',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Clear sync queue from create
      await db.syncQueue.clear();

      // Update product
      await repository.updateLocal(product.id!, { name: 'Updated' }, 1);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].operation).toBe('UPDATE');
    });

    it('should throw error if product not found', async () => {
      await expect(
        repository.updateLocal(9999, { name: 'Test' }, 1)
      ).rejects.toThrow('Product not found');
    });

    it('should throw error if product is deleted', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-005',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Delete product
      await repository.deleteLocal(product.id!, 1);

      // Try to update deleted product
      await expect(
        repository.updateLocal(product.id!, { name: 'Updated' }, 1)
      ).rejects.toThrow('Product is deleted');
    });
  });

  describe('deleteLocal', () => {
    it('should soft delete a product', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-006',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Delete product
      await repository.deleteLocal(product.id!, 1);

      // Verify soft delete
      const deleted = await db.products.get(product.id!);
      expect(deleted?.deletedAt).toBeDefined();
      expect(deleted?._syncStatus).toBe(SyncStatus.PENDING_DELETE);

      // Should not appear in getAll()
      const allProducts = await repository.getAll();
      expect(allProducts.length).toBe(0);
    });

    it('should add delete operation to sync queue', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-007',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Clear sync queue
      await db.syncQueue.clear();

      // Delete product
      await repository.deleteLocal(product.id!, 1);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].operation).toBe('DELETE');
    });

    it('should throw error if product already deleted', async () => {
      const productData: CreateProductDTO = {
        name: 'Test Product',
        code: 'TEST-008',
        unit: 'pcs',
        salePrice: 100.00,
      };

      const product = await repository.createLocal(productData, 1);

      // Delete once
      await repository.deleteLocal(product.id!, 1);

      // Try to delete again
      await expect(
        repository.deleteLocal(product.id!, 1)
      ).rejects.toThrow('Product is already deleted');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test products
      await repository.createLocal({
        name: 'Apple iPhone',
        code: 'PHONE-001',
        unit: 'pcs',
        salePrice: 999.00,
      }, 1);

      await repository.createLocal({
        name: 'Samsung Galaxy',
        code: 'PHONE-002',
        unit: 'pcs',
        salePrice: 899.00,
      }, 1);

      await repository.createLocal({
        name: 'Apple MacBook',
        code: 'LAPTOP-001',
        unit: 'pcs',
        salePrice: 1999.00,
      }, 1);
    });

    it('should search products by name (case-insensitive)', async () => {
      const results = await repository.search('apple');
      expect(results.length).toBe(2);
      expect(results.every(p => p.name.toLowerCase().includes('apple'))).toBe(true);
    });

    it('should search products by code (case-insensitive)', async () => {
      const results = await repository.search('phone');
      expect(results.length).toBe(2);
      expect(results.every(p => p.code.toLowerCase().includes('phone'))).toBe(true);
    });

    it('should return all products if search term is empty', async () => {
      const results = await repository.search('');
      expect(results.length).toBe(3);
    });

    it('should return empty array if no matches', async () => {
      const results = await repository.search('nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('saveFromServer', () => {
    it('should insert new product from server', async () => {
      const serverProduct: ServerProduct = {
        id: 100,
        name: 'Server Product',
        code: 'SRV-001',
        unit: 'pcs',
        salePrice: 150.00,
        categoryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };

      const product = await repository.saveFromServer(serverProduct, 1);

      expect(product.serverId).toBe(100);
      expect(product.name).toBe('Server Product');
      expect(product._syncStatus).toBe(SyncStatus.SYNCED);
    });

    it('should update existing product from server', async () => {
      const serverProduct: ServerProduct = {
        id: 100,
        name: 'Original Name',
        code: 'SRV-002',
        unit: 'pcs',
        salePrice: 100.00,
        categoryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };

      // Insert first time
      await repository.saveFromServer(serverProduct, 1);

      // Update from server
      const updatedServerProduct: ServerProduct = {
        ...serverProduct,
        name: 'Updated Name',
        salePrice: 120.00,
      };

      const updated = await repository.saveFromServer(updatedServerProduct, 1);

      expect(updated.name).toBe('Updated Name');
      expect(updated.salePrice).toBe(120.00);

      // Should not create duplicate
      const allProducts = await repository.getAll();
      const serverProducts = allProducts.filter(p => p.serverId === 100);
      expect(serverProducts.length).toBe(1);
    });
  });

  describe('getByCode', () => {
    it('should get product by code (case-insensitive)', async () => {
      await repository.createLocal({
        name: 'Test Product',
        code: 'UNIQUE-001',
        unit: 'pcs',
        salePrice: 100.00,
      }, 1);

      const product = await repository.getByCode('unique-001');
      expect(product).toBeDefined();
      expect(product?.code).toBe('UNIQUE-001');
    });

    it('should return undefined if code not found', async () => {
      const product = await repository.getByCode('NONEXISTENT');
      expect(product).toBeUndefined();
    });
  });

  describe('getWithPrices', () => {
    it('should get product with all its prices', async () => {
      // Create product
      const product = await repository.createLocal({
        name: 'Product with Prices',
        code: 'PWP-001',
        unit: 'pcs',
        salePrice: 100.00,
      }, 1);

      // Add prices
      await db.prices.add({
        productId: product.id!,
        supplierId: 1,
        price: 90.00,
        updatedByUserId: 1,
        _syncStatus: SyncStatus.SYNCED,
        _version: 1,
        _lastModifiedAt: Date.now(),
      });

      await db.prices.add({
        productId: product.id!,
        supplierId: 2,
        price: 85.00,
        updatedByUserId: 1,
        _syncStatus: SyncStatus.SYNCED,
        _version: 1,
        _lastModifiedAt: Date.now(),
      });

      const result = await repository.getWithPrices(product.id!);

      expect(result).not.toBeNull();
      expect(result?.product.name).toBe('Product with Prices');
      expect(result?.prices.length).toBe(2);
    });

    it('should return null if product not found', async () => {
      const result = await repository.getWithPrices(9999);
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Create products
      const p1 = await repository.createLocal({
        name: 'Product 1',
        code: 'P1',
        unit: 'pcs',
        salePrice: 100.00,
        categoryId: 1,
      }, 1);

      const p2 = await repository.createLocal({
        name: 'Product 2',
        code: 'P2',
        unit: 'pcs',
        salePrice: 200.00,
        categoryId: 1,
      }, 1);

      const p3 = await repository.createLocal({
        name: 'Product 3',
        code: 'P3',
        unit: 'pcs',
        salePrice: 300.00,
        categoryId: 2,
      }, 1);

      // Add price to p1
      await db.prices.add({
        productId: p1.id!,
        supplierId: 1,
        price: 90.00,
        updatedByUserId: 1,
        _syncStatus: SyncStatus.SYNCED,
        _version: 1,
        _lastModifiedAt: Date.now(),
      });

      const stats = await repository.getStats();

      expect(stats.total).toBe(3);
      expect(stats.withPrices).toBe(1);
      expect(stats.withoutPrices).toBe(2);
      expect(stats.byCategory[1]).toBe(2);
      expect(stats.byCategory[2]).toBe(1);
    });
  });
});
