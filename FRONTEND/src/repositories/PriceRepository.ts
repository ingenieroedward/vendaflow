import { BaseRepository } from './BaseRepository';
import { db, LocalPrice, LocalProduct, LocalSupplier, SyncStatus } from '../database/LocalDatabase';
import {
  ServerPrice,
  CreatePriceDTO,
  PriceValidation,
  PriceTransform,
  PriceComparison
} from '../database/models';
import { productRepository } from './ProductRepository';
import { supplierRepository } from './SupplierRepository';

/**
 * Price comparison result interface
 */
export interface PriceComparisonResult {
  productId: number;
  productName?: string;
  prices: Array<{
    supplierId: number;
    supplierName?: string;
    price: number;
    isLowest: boolean;
    isHighest: boolean;
    differenceFromLowest: number;
    differencePercentage: number;
  }>;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceRange: number;
}

/**
 * Repository for Price entities
 * Handles price management with product and supplier relationships
 * Validates referential integrity before creating/updating prices
 */
export class PriceRepository extends BaseRepository<
  LocalPrice,
  ServerPrice,
  CreatePriceDTO
> {
  constructor() {
    super(db.prices, 'Price');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerPrice, userId?: number): Omit<LocalPrice, 'id'> {
    return PriceTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalPrice): Partial<ServerPrice> {
    return PriceTransform.toServer(localData);
  }

  protected validate(data: CreatePriceDTO): { valid: boolean; errors: string[] } {
    return PriceValidation.validate(data);
  }

  /**
   * Override createLocal to validate relationships
   * Ensures product and supplier exist before creating price
   */
  async createLocal(data: CreatePriceDTO, userId?: number): Promise<LocalPrice> {
    // Validate product exists
    const product = await productRepository.getById(data.productId);
    if (!product) {
      throw new Error(`Product with id ${data.productId} not found`);
    }

    // Validate supplier exists
    const supplier = await supplierRepository.getById(data.supplierId);
    if (!supplier) {
      throw new Error(`Supplier with id ${data.supplierId} not found`);
    }

    // Validate basic data
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Price validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if price already exists for this product-supplier combination
    const existingPrice = await this.getByProductAndSupplier(data.productId, data.supplierId);
    if (existingPrice) {
      throw new Error(
        `Price already exists for product ${data.productId} and supplier ${data.supplierId}. Use update instead.`
      );
    }

    // Create price using parent method
    return super.createLocal(data, userId);
  }

  /**
   * Override updateLocal to validate relationships
   */
  async updateLocal(id: number, data: Partial<CreatePriceDTO>, userId?: number): Promise<LocalPrice> {
    // If updating productId or supplierId, validate they exist
    if (data.productId) {
      const product = await productRepository.getById(data.productId);
      if (!product) {
        throw new Error(`Product with id ${data.productId} not found`);
      }
    }

    if (data.supplierId) {
      const supplier = await supplierRepository.getById(data.supplierId);
      if (!supplier) {
        throw new Error(`Supplier with id ${data.supplierId} not found`);
      }
    }

    return super.updateLocal(id, data, userId);
  }

  // Price-specific methods

  /**
   * Get all prices for a specific product
   * @param productId - Product ID
   * @returns Array of prices for that product
   */
  async getByProduct(productId: number): Promise<LocalPrice[]> {
    return await this.table
      .where('productId')
      .equals(productId)
      .filter(price => !price.deletedAt)
      .toArray();
  }

  /**
   * Get all prices for a specific supplier
   * @param supplierId - Supplier ID
   * @returns Array of prices for that supplier
   */
  async getBySupplier(supplierId: number): Promise<LocalPrice[]> {
    return await this.table
      .where('supplierId')
      .equals(supplierId)
      .filter(price => !price.deletedAt)
      .toArray();
  }

  /**
   * Get price for a specific product-supplier combination
   * @param productId - Product ID
   * @param supplierId - Supplier ID
   * @returns Price or null if not found
   */
  async getByProductAndSupplier(productId: number, supplierId: number): Promise<LocalPrice | null> {
    const price = await this.table
      .filter(p =>
        p.productId === productId &&
        p.supplierId === supplierId &&
        !p.deletedAt
      )
      .first();

    return price || null;
  }

  /**
   * Find the lowest price for a specific product across all suppliers
   * @param productId - Product ID
   * @returns Lowest price or null if no prices exist
   */
  async findLowestPriceForProduct(productId: number): Promise<LocalPrice | null> {
    const prices = await this.getByProduct(productId);
    return PriceComparison.findLowestPrice(prices);
  }

  /**
   * Find the highest price for a specific product across all suppliers
   * @param productId - Product ID
   * @returns Highest price or null if no prices exist
   */
  async findHighestPriceForProduct(productId: number): Promise<LocalPrice | null> {
    const prices = await this.getByProduct(productId);
    return PriceComparison.findHighestPrice(prices);
  }

  /**
   * Compare prices for a product across all suppliers
   * Returns detailed comparison with statistics
   * @param productId - Product ID
   * @returns Comparison result with statistics
   */
  async compareSuppliers(productId: number): Promise<PriceComparisonResult | null> {
    const prices = await this.getByProduct(productId);

    if (prices.length === 0) {
      return null;
    }

    // Get product details
    const product = await productRepository.getById(productId);

    // Find lowest and highest
    const lowestPriceObj = PriceComparison.findLowestPrice(prices);
    const highestPriceObj = PriceComparison.findHighestPrice(prices);

    if (!lowestPriceObj || !highestPriceObj) {
      return null;
    }

    const lowestPrice = lowestPriceObj.price;
    const highestPrice = highestPriceObj.price;
    const averagePrice = PriceComparison.calculateAveragePrice(prices);

    // Build comparison for each price
    const priceComparisons = await Promise.all(
      prices.map(async (price) => {
        const supplier = await supplierRepository.getById(price.supplierId);
        const differenceFromLowest = price.price - lowestPrice;
        const differencePercentage = PriceComparison.calculatePriceDifference(
          lowestPrice,
          price.price
        );

        return {
          supplierId: price.supplierId,
          supplierName: supplier?.name,
          price: price.price,
          isLowest: price.price === lowestPrice,
          isHighest: price.price === highestPrice,
          differenceFromLowest,
          differencePercentage
        };
      })
    );

    // Sort by price (lowest first)
    priceComparisons.sort((a, b) => a.price - b.price);

    return {
      productId,
      productName: product?.name,
      prices: priceComparisons,
      lowestPrice,
      highestPrice,
      averagePrice,
      priceRange: highestPrice - lowestPrice
    };
  }

  /**
   * Bulk update multiple prices
   * More efficient than updating one by one
   * @param prices - Array of price updates with id
   * @param userId - User ID for tracking
   * @returns Number of prices updated
   */
  async bulkUpdatePrices(
    prices: Array<{ id: number; price: number; updatedByUserId: number }>,
    userId?: number
  ): Promise<number> {
    let updatedCount = 0;

    await db.transaction('rw', [db.prices, db.syncQueue], async () => {
      for (const priceUpdate of prices) {
        const existing = await this.getById(priceUpdate.id);
        if (!existing || existing.deletedAt) {
          continue; // Skip if not found or deleted
        }

        // Update price
        await db.prices.update(priceUpdate.id, {
          price: priceUpdate.price,
          updatedByUserId: priceUpdate.updatedByUserId,
          _syncStatus: SyncStatus.PENDING_UPDATE,
          _version: existing._version + 1,
          _lastModifiedAt: Date.now(),
          _lastModifiedBy: userId
        });

        // Add to sync queue
        await this.addToSyncQueue('UPDATE', priceUpdate.id);

        updatedCount++;
      }
    });

    return updatedCount;
  }

  /**
   * Get product with all its prices from different suppliers
   * @param productId - Product ID
   * @returns Product with prices or null
   */
  async getProductWithPrices(productId: number): Promise<{
    product: LocalProduct;
    prices: LocalPrice[];
  } | null> {
    const product = await productRepository.getById(productId);
    if (!product) {
      return null;
    }

    const prices = await this.getByProduct(productId);

    return {
      product,
      prices
    };
  }

  /**
   * Get supplier with all its prices for different products
   * @param supplierId - Supplier ID
   * @returns Supplier with prices or null
   */
  async getSupplierWithPrices(supplierId: number): Promise<{
    supplier: LocalSupplier;
    prices: LocalPrice[];
  } | null> {
    const supplier = await supplierRepository.getById(supplierId);
    if (!supplier) {
      return null;
    }

    const prices = await this.getBySupplier(supplierId);

    return {
      supplier,
      prices
    };
  }

  /**
   * Get products that have no prices defined
   * @returns Array of products without prices
   */
  async getProductsWithoutPrices(): Promise<LocalProduct[]> {
    const allProducts = await productRepository.getAll();
    const productsWithoutPrices: LocalProduct[] = [];

    for (const product of allProducts) {
      const prices = await this.getByProduct(product.id!);
      if (prices.length === 0) {
        productsWithoutPrices.push(product);
      }
    }

    return productsWithoutPrices;
  }

  /**
   * Get suppliers that have no prices defined
   * @returns Array of suppliers without prices
   */
  async getSuppliersWithoutPrices(): Promise<LocalSupplier[]> {
    const allSuppliers = await supplierRepository.getAll();
    const suppliersWithoutPrices: LocalSupplier[] = [];

    for (const supplier of allSuppliers) {
      const prices = await this.getBySupplier(supplier.id!);
      if (prices.length === 0) {
        suppliersWithoutPrices.push(supplier);
      }
    }

    return suppliersWithoutPrices;
  }

  /**
   * Get statistics about prices
   * @returns Statistics object
   */
  async getStats(): Promise<{
    total: number;
    byProduct: number;
    bySupplier: number;
    averagePrice: number;
    lowestPrice: number;
    highestPrice: number;
    productsWithPrices: number;
    productsWithoutPrices: number;
    suppliersWithPrices: number;
    suppliersWithoutPrices: number;
  }> {
    const allPrices = await this.getAll();

    // Unique products and suppliers with prices
    const uniqueProducts = new Set(allPrices.map(p => p.productId));
    const uniqueSuppliers = new Set(allPrices.map(p => p.supplierId));

    // Calculate price statistics
    const priceValues = allPrices.map(p => p.price);
    const averagePrice = priceValues.length > 0
      ? Math.round((priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length) * 100) / 100
      : 0;
    const lowestPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
    const highestPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;

    // Total products and suppliers
    const totalProducts = await productRepository.getAll();
    const totalSuppliers = await supplierRepository.getAll();

    return {
      total: allPrices.length,
      byProduct: uniqueProducts.size,
      bySupplier: uniqueSuppliers.size,
      averagePrice,
      lowestPrice,
      highestPrice,
      productsWithPrices: uniqueProducts.size,
      productsWithoutPrices: totalProducts.length - uniqueProducts.size,
      suppliersWithPrices: uniqueSuppliers.size,
      suppliersWithoutPrices: totalSuppliers.length - uniqueSuppliers.size
    };
  }

  /**
   * Delete all prices for a specific product
   * Used when deleting a product
   * @param productId - Product ID
   * @param userId - User ID for tracking
   */
  async deleteByProduct(productId: number, userId?: number): Promise<void> {
    const prices = await this.getByProduct(productId);

    for (const price of prices) {
      if (price.id) {
        await this.deleteLocal(price.id, userId);
      }
    }
  }

  /**
   * Delete all prices for a specific supplier
   * Used when deleting a supplier
   * @param supplierId - Supplier ID
   * @param userId - User ID for tracking
   */
  async deleteBySupplier(supplierId: number, userId?: number): Promise<void> {
    const prices = await this.getBySupplier(supplierId);

    for (const price of prices) {
      if (price.id) {
        await this.deleteLocal(price.id, userId);
      }
    }
  }
}

// Export singleton instance
export const priceRepository = new PriceRepository();
