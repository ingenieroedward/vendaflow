import { BaseRepository } from './BaseRepository';
import { db, LocalProduct, LocalPrice } from '../database/LocalDatabase';
import {
  ServerProduct,
  CreateProductDTO,
  ProductValidation,
  ProductTransform
} from '../database/models';

/**
 * Repository for Product entities
 * Handles CRUD operations with offline-first support
 */
export class ProductRepository extends BaseRepository<
  LocalProduct,
  ServerProduct,
  CreateProductDTO
> {
  constructor() {
    super(db.products, 'Product');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerProduct, userId?: number): Omit<LocalProduct, 'id'> {
    return ProductTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalProduct): Partial<ServerProduct> {
    return ProductTransform.toServer(localData);
  }

  protected validate(data: CreateProductDTO): { valid: boolean; errors: string[] } {
    return ProductValidation.validate(data);
  }

  // Product-specific methods

  /**
   * Search products by name or code (case-insensitive)
   */
  async search(searchTerm: string): Promise<LocalProduct[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(product =>
        !product.deletedAt &&
        (product.name.toLowerCase().includes(term) ||
         product.code.toLowerCase().includes(term))
      )
      .toArray();
  }

  /**
   * Get products by category
   */
  async getByCategory(categoryId: number): Promise<LocalProduct[]> {
    return await this.table
      .where('categoryId')
      .equals(categoryId)
      .filter(product => !product.deletedAt)
      .toArray();
  }

  /**
   * Get product by code (unique)
   */
  async getByCode(code: string): Promise<LocalProduct | undefined> {
    const products = await this.table
      .filter(product =>
        !product.deletedAt &&
        product.code.toLowerCase() === code.toLowerCase()
      )
      .toArray();

    return products.length > 0 ? products[0] : undefined;
  }

  /**
   * Get products with their prices from all suppliers (by local ID)
   */
  async getWithPrices(productId: number): Promise<{
    product: LocalProduct;
    prices: LocalPrice[];
  } | null> {
    const product = await this.getById(productId);
    if (!product) {
      return null;
    }

    const prices = await db.prices
      .where('productId')
      .equals(productId)
      .filter(price => !price.deletedAt)
      .toArray();

    return {
      product,
      prices
    };
  }

  /**
   * Get products with their prices by server ID
   */
  async getWithPricesByServerId(serverId: number): Promise<{
    product: LocalProduct;
    prices: Array<LocalPrice & { supplier?: any }>;
  } | null> {
    const product = await this.getByServerId(serverId);
    if (!product) {
      return null;
    }

    // Prices are stored with server's productId
    const prices = await db.prices
      .where('productId')
      .equals(serverId)
      .filter(price => !price.deletedAt)
      .toArray();

    // Populate supplier for each price
    const pricesWithSupplier = await Promise.all(
      prices.map(async (price) => {
        let supplier = undefined;
        if (price.supplierId != null) {
          supplier = await db.suppliers
            .where('serverId')
            .equals(price.supplierId)
            .first();
          if (!supplier) {
            supplier = await db.suppliers.get(price.supplierId);
          }
        }
        return { ...price, supplier };
      })
    );

    return {
      product,
      prices: pricesWithSupplier
    };
  }

  /**
   * Get all products with their prices (including supplier info)
   */
  async getAllWithPrices(): Promise<Array<{
    product: LocalProduct;
    prices: Array<LocalPrice & { supplier?: any }>;
  }>> {
    const products = await this.getAll();
    const results = [];

    for (const product of products) {
      // Use serverId to match prices (prices are saved with server's productId)
      const productIdToSearch = product.serverId || product.id;

      // Skip if no valid ID to search
      if (!productIdToSearch) {
        results.push({ product, prices: [] });
        continue;
      }

      const prices = await db.prices
        .where('productId')
        .equals(productIdToSearch)
        .filter(price => !price.deletedAt)
        .toArray();

      // Populate supplier for each price (using serverId)
      const pricesWithSupplier = await Promise.all(
        prices.map(async (price) => {
          let supplier = undefined;

          // Only query if supplierId is valid
          if (price.supplierId != null) {
            // Find supplier by serverId since prices store server's supplierId
            supplier = await db.suppliers
              .where('serverId')
              .equals(price.supplierId)
              .first();

            // Fallback to local id
            if (!supplier) {
              supplier = await db.suppliers.get(price.supplierId);
            }
          }

          return {
            ...price,
            supplier
          };
        })
      );

      results.push({
        product,
        prices: pricesWithSupplier
      });
    }

    return results;
  }

  /**
   * Search products with their prices (including supplier info)
   */
  async searchWithPrices(searchTerm: string): Promise<Array<{
    product: LocalProduct;
    prices: Array<LocalPrice & { supplier?: any }>;
  }>> {
    const products = await this.search(searchTerm);
    const results = [];

    for (const product of products) {
      // Use serverId to match prices (prices are saved with server's productId)
      const productIdToSearch = product.serverId || product.id;

      // Skip if no valid ID to search
      if (!productIdToSearch) {
        results.push({ product, prices: [] });
        continue;
      }

      const prices = await db.prices
        .where('productId')
        .equals(productIdToSearch)
        .filter(price => !price.deletedAt)
        .toArray();

      // Populate supplier for each price (using serverId)
      const pricesWithSupplier = await Promise.all(
        prices.map(async (price) => {
          let supplier = undefined;

          // Only query if supplierId is valid
          if (price.supplierId != null) {
            // Find supplier by serverId since prices store server's supplierId
            supplier = await db.suppliers
              .where('serverId')
              .equals(price.supplierId)
              .first();

            // Fallback to local id
            if (!supplier) {
              supplier = await db.suppliers.get(price.supplierId);
            }
          }

          return {
            ...price,
            supplier
          };
        })
      );

      results.push({
        product,
        prices: pricesWithSupplier
      });
    }

    return results;
  }

  /**
   * Check if a product code already exists
   */
  async codeExists(code: string, excludeId?: number): Promise<boolean> {
    const products = await this.table
      .filter(product =>
        !product.deletedAt &&
        product.code.toLowerCase() === code.toLowerCase() &&
        (!excludeId || product.id !== excludeId)
      )
      .toArray();

    return products.length > 0;
  }

  /**
   * Get products with low or no prices
   */
  async getProductsWithoutPrices(): Promise<LocalProduct[]> {
    const allProducts = await this.getAll();
    const productsWithoutPrices = [];

    for (const product of allProducts) {
      const prices = await db.prices
        .where('productId')
        .equals(product.id!)
        .filter(price => !price.deletedAt)
        .toArray();

      if (prices.length === 0) {
        productsWithoutPrices.push(product);
      }
    }

    return productsWithoutPrices;
  }

  /**
   * Get statistics about products
   */
  async getStats(): Promise<{
    total: number;
    withPrices: number;
    withoutPrices: number;
    byCategory: Record<number, number>;
  }> {
    const allProducts = await this.getAll();
    const stats = {
      total: allProducts.length,
      withPrices: 0,
      withoutPrices: 0,
      byCategory: {} as Record<number, number>
    };

    for (const product of allProducts) {
      // Count by category
      if (product.categoryId) {
        stats.byCategory[product.categoryId] = (stats.byCategory[product.categoryId] || 0) + 1;
      }

      // Count with/without prices
      const prices = await db.prices
        .where('productId')
        .equals(product.id!)
        .filter(price => !price.deletedAt)
        .toArray();

      if (prices.length > 0) {
        stats.withPrices++;
      } else {
        stats.withoutPrices++;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const productRepository = new ProductRepository();
