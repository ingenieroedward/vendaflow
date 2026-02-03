import { BaseRepository } from './BaseRepository';
import { db, LocalSupplier, LocalPrice } from '../database/LocalDatabase';
import {
  ServerSupplier,
  CreateSupplierDTO,
  SupplierValidation,
  SupplierTransform
} from '../database/models';

/**
 * Repository for Supplier entities
 * Handles supplier management with location-based search
 */
export class SupplierRepository extends BaseRepository<
  LocalSupplier,
  ServerSupplier,
  CreateSupplierDTO
> {
  constructor() {
    super(db.suppliers, 'Supplier');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerSupplier, userId?: number): Omit<LocalSupplier, 'id'> {
    return SupplierTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalSupplier): Partial<ServerSupplier> {
    return SupplierTransform.toServer(localData);
  }

  protected validate(data: CreateSupplierDTO): { valid: boolean; errors: string[] } {
    return SupplierValidation.validate(data);
  }

  // Supplier-specific methods

  /**
   * Search suppliers by name or location
   * @param searchTerm - Term to search for (case-insensitive)
   * @returns Array of matching suppliers
   */
  async search(searchTerm: string): Promise<LocalSupplier[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(supplier =>
        !supplier.deletedAt && (
          supplier.name.toLowerCase().includes(term) ||
          supplier.location.toLowerCase().includes(term)
        )
      )
      .toArray();
  }

  /**
   * Search suppliers by name
   * @param name - Name to search for
   * @returns Array of matching suppliers
   */
  async searchByName(name: string): Promise<LocalSupplier[]> {
    if (!name || name.trim() === '') {
      return this.getAll();
    }

    const term = name.toLowerCase().trim();

    return await this.table
      .filter(supplier =>
        !supplier.deletedAt &&
        supplier.name.toLowerCase().includes(term)
      )
      .toArray();
  }

  /**
   * Get suppliers by location
   * @param location - Location to filter by
   * @returns Array of suppliers in that location
   */
  async searchByLocation(location: string): Promise<LocalSupplier[]> {
    if (!location || location.trim() === '') {
      return [];
    }

    const term = location.toLowerCase().trim();

    return await this.table
      .filter(supplier =>
        !supplier.deletedAt &&
        supplier.location.toLowerCase().includes(term)
      )
      .toArray();
  }

  /**
   * Get supplier with all its prices
   * @param supplierId - Supplier ID
   * @returns Supplier with prices or null if not found
   */
  async getWithPrices(supplierId: number): Promise<{
    supplier: LocalSupplier;
    prices: LocalPrice[];
  } | null> {
    const supplier = await this.getById(supplierId);
    if (!supplier) {
      return null;
    }

    const prices = await db.prices
      .where('supplierId')
      .equals(supplierId)
      .filter(price => !price.deletedAt)
      .toArray();

    return {
      supplier,
      prices
    };
  }

  /**
   * Get all suppliers with their price counts
   * @returns Array of suppliers with price count
   */
  async getAllWithPriceCounts(): Promise<Array<{
    supplier: LocalSupplier;
    priceCount: number;
  }>> {
    const suppliers = await this.getAll();

    const suppliersWithCounts = await Promise.all(
      suppliers.map(async (supplier) => {
        const priceCount = await db.prices
          .where('supplierId')
          .equals(supplier.id!)
          .filter(price => !price.deletedAt)
          .count();

        return {
          supplier,
          priceCount
        };
      })
    );

    return suppliersWithCounts;
  }

  /**
   * Get suppliers ordered by name alphabetically
   * @returns Array of suppliers sorted by name
   */
  async getAllSortedByName(): Promise<LocalSupplier[]> {
    const suppliers = await this.getAll();
    return suppliers.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get suppliers ordered by location
   * @returns Array of suppliers sorted by location
   */
  async getAllSortedByLocation(): Promise<LocalSupplier[]> {
    const suppliers = await this.getAll();
    return suppliers.sort((a, b) => a.location.localeCompare(b.location));
  }

  /**
   * Get all unique locations from suppliers
   * @returns Array of unique locations
   */
  async getUniqueLocations(): Promise<string[]> {
    const suppliers = await this.getAll();
    const locations = suppliers.map(s => s.location);
    return Array.from(new Set(locations)).sort();
  }

  /**
   * Check if a supplier with the same name already exists
   * @param name - Supplier name to check
   * @param excludeId - Optional ID to exclude from check (for updates)
   * @returns True if supplier exists
   */
  async supplierNameExists(name: string, excludeId?: number): Promise<boolean> {
    const suppliers = await this.table
      .filter(supplier =>
        supplier.name.toLowerCase() === name.toLowerCase() &&
        (!excludeId || supplier.id !== excludeId) &&
        !supplier.deletedAt
      )
      .toArray();

    return suppliers.length > 0;
  }

  /**
   * Get statistics about suppliers
   * @returns Statistics object
   */
  async getStats(): Promise<{
    total: number;
    byLocation: Record<string, number>;
    withPrices: number;
    synced: number;
    pendingSync: number;
  }> {
    const allSuppliers = await this.getAll();

    // Count by location
    const byLocation: Record<string, number> = {};
    for (const supplier of allSuppliers) {
      byLocation[supplier.location] = (byLocation[supplier.location] || 0) + 1;
    }

    // Count suppliers with prices
    let withPrices = 0;
    for (const supplier of allSuppliers) {
      const priceCount = await db.prices
        .where('supplierId')
        .equals(supplier.id!)
        .filter(price => !price.deletedAt)
        .count();

      if (priceCount > 0) {
        withPrices++;
      }
    }

    return {
      total: allSuppliers.length,
      byLocation,
      withPrices,
      synced: allSuppliers.filter(s => s._syncStatus === 'SYNCED').length,
      pendingSync: allSuppliers.filter(s => s._syncStatus !== 'SYNCED').length
    };
  }
}

// Export singleton instance
export const supplierRepository = new SupplierRepository();
