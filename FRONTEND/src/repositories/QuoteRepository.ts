import { BaseRepository } from './BaseRepository';
import { db, LocalQuote, LocalQuoteItem, SyncStatus } from '../database/LocalDatabase';
import {
  ServerQuote,
  ServerQuoteItem,
  CreateQuoteDTO,
  CreateQuoteItemDTO,
  CreateQuoteWithItemsDTO,
  QuoteValidation,
  QuoteItemValidation,
  QuoteCalculations,
  QuoteTransform,
  QuoteItemTransform
} from '../database/models';
import { createBaseModel } from '../database/schemas';

/**
 * Repository for Quote entities
 * Handles quotes with their items in transactions — mirror de OrderRepository.ts,
 * sin descuento de stock (una cotización no es una venta concretada).
 */
export class QuoteRepository extends BaseRepository<
  LocalQuote,
  ServerQuote,
  CreateQuoteDTO
> {
  constructor() {
    super(db.quotes, 'Quote');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerQuote, userId?: number): Omit<LocalQuote, 'id'> {
    return QuoteTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalQuote): Partial<ServerQuote> {
    return QuoteTransform.toServer(localData);
  }

  protected validate(data: CreateQuoteDTO): { valid: boolean; errors: string[] } {
    return QuoteValidation.validate(data);
  }

  // Quote-specific methods

  /**
   * Search quotes by quote number
   */
  async search(searchTerm: string): Promise<LocalQuote[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(quote =>
        !quote.deletedAt &&
        (quote.quoteNumber.toLowerCase().includes(term))
      )
      .toArray();
  }

  /**
   * Get quotes by customer
   */
  async getByCustomer(customerId: number): Promise<LocalQuote[]> {
    return await this.table
      .where('customerId')
      .equals(customerId)
      .filter(quote => !quote.deletedAt)
      .toArray();
  }

  /**
   * Get quotes by status
   */
  async getByStatus(status: string): Promise<LocalQuote[]> {
    return await this.table
      .where('status')
      .equals(status)
      .filter(quote => !quote.deletedAt)
      .toArray();
  }

  /**
   * Get next available quote number
   * Format: COT-001, COT-002, etc.
   */
  async getNextQuoteNumber(): Promise<string> {
    const allQuotes = await db.quotes.toArray();

    const numbers = allQuotes
      .map(quote => {
        const match = quote.quoteNumber.match(/COT-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    // También considerar el máximo del servidor guardado en seed
    // para que limpiar datos locales no reinicie la numeración a COT-001
    const serverMax = parseInt(localStorage.getItem('serverMaxQuoteNumber') ?? '0', 10);

    const maxNumber = Math.max(...numbers, serverMax, 0);
    const nextNumber = maxNumber + 1;
    return `COT-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Check if quote number already exists
   */
  async quoteNumberExists(quoteNumber: string, excludeId?: number): Promise<boolean> {
    const quotes = await this.table
      .filter(quote =>
        quote.quoteNumber.toLowerCase() === quoteNumber.toLowerCase() &&
        (!excludeId || quote.id !== excludeId)
      )
      .toArray();

    return quotes.length > 0;
  }

  /**
   * Get quote with all its items
   */
  async getQuoteWithItems(quoteId: number): Promise<{
    quote: LocalQuote;
    items: LocalQuoteItem[];
  } | null> {
    const quote = await this.getById(quoteId);
    if (!quote) {
      return null;
    }

    const items = await db.quoteItems
      .where('quoteId')
      .equals(quoteId)
      .filter(item => !item.deletedAt)
      .toArray();

    return {
      quote,
      items
    };
  }

  /**
   * Create quote with items in a transaction
   * Validates totals and ensures atomicity
   */
  async createQuoteWithItems(
    data: CreateQuoteWithItemsDTO,
    userId?: number
  ): Promise<{ quote: LocalQuote; items: LocalQuoteItem[] }> {
    // Validate quote
    const quoteValidation = QuoteValidation.validate(data.quote);
    if (!quoteValidation.valid) {
      throw new Error(`Quote validation failed: ${quoteValidation.errors.join(', ')}`);
    }

    // Validate all items
    for (let i = 0; i < data.items.length; i++) {
      const itemValidation = QuoteItemValidation.validate(data.items[i]);
      if (!itemValidation.valid) {
        throw new Error(`Item ${i + 1} validation failed: ${itemValidation.errors.join(', ')}`);
      }
    }

    // Validate that totalAmount matches sum of items
    const calculatedTotal = QuoteCalculations.calculateQuoteTotal(data.items);
    if (!QuoteCalculations.validateQuoteTotal(data.quote.totalAmount, data.items)) {
      throw new Error(
        `Quote total (${data.quote.totalAmount}) does not match sum of items (${calculatedTotal})`
      );
    }

    // Create in transaction
    return await db.transaction('rw', [db.quotes, db.quoteItems, db.syncQueue], async () => {
      // Create quote
      const quoteWithMeta = {
        // Fecha de creación local — el valor del servidor la reemplaza al sincronizar.
        // Sin esto, las cotizaciones creadas offline no aparecen en filtros por fecha.
        createdAt: new Date().toISOString(),
        ...data.quote,
        ...createBaseModel(userId)
      } as Omit<LocalQuote, 'id'>;

      const quoteId = await db.quotes.add(quoteWithMeta as LocalQuote);

      // Add to sync queue
      await this.addToSyncQueue('CREATE', quoteId);

      // Create items
      const itemsToCreate = data.items.map(item => ({
        ...item,
        quoteId,
        ...createBaseModel(userId)
      })) as Omit<LocalQuoteItem, 'id'>[];

      await db.quoteItems.bulkAdd(itemsToCreate as LocalQuoteItem[]);

      // Add items to sync queue (each item as a separate queue entry)
      for (const item of itemsToCreate) {
        const itemId = await db.quoteItems
          .where({ quoteId, productId: item.productId })
          .first()
          .then(i => i?.id);

        if (itemId) {
          await db.syncQueue.add({
            entityType: 'quote_item',
            entityLocalId: itemId,
            operation: 'create',
            data: {},
            attempts: 0,
            createdAt: Date.now(),
          } as any);
        }
      }

      // Fetch created quote and items
      const createdQuote = await db.quotes.get(quoteId);
      const createdItems = await db.quoteItems.where('quoteId').equals(quoteId).toArray();

      if (!createdQuote) {
        throw new Error('Failed to retrieve created quote');
      }

      return {
        quote: createdQuote,
        items: createdItems
      };
    });
  }

  /**
   * Update quote with items
   * Handles adding, updating, and removing items
   */
  async updateQuoteWithItems(
    quoteId: number,
    quoteUpdates: Partial<CreateQuoteDTO>,
    items: CreateQuoteItemDTO[],
    userId?: number
  ): Promise<{ quote: LocalQuote; items: LocalQuoteItem[] }> {
    const existing = await this.getById(quoteId);
    if (!existing) {
      throw new Error(`Quote not found with id ${quoteId}`);
    }

    if (existing.deletedAt) {
      throw new Error('Quote is deleted');
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const itemValidation = QuoteItemValidation.validate(items[i]);
      if (!itemValidation.valid) {
        throw new Error(`Item ${i + 1} validation failed: ${itemValidation.errors.join(', ')}`);
      }
    }

    // Calculate new total from items
    const calculatedTotal = QuoteCalculations.calculateQuoteTotal(items);

    // Update in transaction
    return await db.transaction('rw', [db.quotes, db.quoteItems, db.syncQueue], async () => {
      // Update quote
      const quoteUpdateData: Partial<LocalQuote> = {
        ...quoteUpdates,
        totalAmount: calculatedTotal, // Always recalculate from items
        _syncStatus: SyncStatus.PENDING_UPDATE,
        _version: existing._version + 1,
        _lastModifiedAt: Date.now(),
        _lastModifiedBy: userId
      } as Partial<LocalQuote>;

      await db.quotes.update(quoteId, quoteUpdateData);
      await this.addToSyncQueue('UPDATE', quoteId);

      // Get existing items
      const existingItems = await db.quoteItems.where('quoteId').equals(quoteId).toArray();

      // Delete all existing items (soft delete)
      for (const existingItem of existingItems) {
        if (existingItem.id) {
          await db.quoteItems.update(existingItem.id, {
            deletedAt: new Date().toISOString(),
            _syncStatus: SyncStatus.PENDING_DELETE,
            _lastModifiedAt: Date.now(),
            _lastModifiedBy: userId
          });

          await db.syncQueue.add({
            entityType: 'quote_item',
            entityLocalId: existingItem.id,
            operation: 'delete',
            data: {},
            attempts: 0,
            createdAt: Date.now(),
          } as any);
        }
      }

      // Create new items
      const newItems = items.map(item => ({
        ...item,
        quoteId,
        ...createBaseModel(userId)
      })) as Omit<LocalQuoteItem, 'id'>[];

      await db.quoteItems.bulkAdd(newItems as LocalQuoteItem[]);

      // Add new items to sync queue
      const createdItems = await db.quoteItems
        .where('quoteId')
        .equals(quoteId)
        .filter(item => !item.deletedAt)
        .toArray();

      for (const item of createdItems) {
        if (item.id) {
          await db.syncQueue.add({
            entityType: 'quote_item',
            entityLocalId: item.id,
            operation: 'create',
            data: {},
            attempts: 0,
            createdAt: Date.now(),
          } as any);
        }
      }

      // Fetch updated quote and items
      const updatedQuote = await db.quotes.get(quoteId);
      const updatedItems = await db.quoteItems
        .where('quoteId')
        .equals(quoteId)
        .filter(item => !item.deletedAt)
        .toArray();

      if (!updatedQuote) {
        throw new Error('Failed to retrieve updated quote');
      }

      return {
        quote: updatedQuote,
        items: updatedItems
      };
    });
  }

  /**
   * Delete quote (soft delete quote and all its items)
   */
  async deleteQuoteWithItems(quoteId: number, userId?: number): Promise<void> {
    const existing = await this.getById(quoteId);
    if (!existing) {
      throw new Error(`Quote not found with id ${quoteId}`);
    }

    if (existing.deletedAt) {
      throw new Error('Quote is already deleted');
    }

    // Delete in transaction
    await db.transaction('rw', [db.quotes, db.quoteItems, db.syncQueue], async () => {
      // Soft delete quote
      await db.quotes.update(quoteId, {
        deletedAt: new Date().toISOString(),
        _syncStatus: SyncStatus.PENDING_DELETE,
        _lastModifiedAt: Date.now(),
        _lastModifiedBy: userId
      });

      await this.addToSyncQueue('DELETE', quoteId);

      // Soft delete all items
      const items = await db.quoteItems.where('quoteId').equals(quoteId).toArray();

      for (const item of items) {
        if (item.id && !item.deletedAt) {
          await db.quoteItems.update(item.id, {
            deletedAt: new Date().toISOString(),
            _syncStatus: SyncStatus.PENDING_DELETE,
            _lastModifiedAt: Date.now(),
            _lastModifiedBy: userId
          });

          await db.syncQueue.add({
            entityType: 'quote_item',
            entityLocalId: item.id,
            operation: 'delete',
            data: {},
            attempts: 0,
            createdAt: Date.now(),
          } as any);
        }
      }
    });
  }

  /**
   * Save quote with items from server
   */
  async saveQuoteWithItemsFromServer(
    serverQuote: ServerQuote,
    serverItems: ServerQuoteItem[],
    userId?: number
  ): Promise<{ quote: LocalQuote; items: LocalQuoteItem[] }> {
    return await db.transaction('rw', [db.quotes, db.quoteItems], async () => {
      // Save quote
      const localQuote = await this.saveFromServer(serverQuote, userId);

      // Save items
      const localItems: LocalQuoteItem[] = [];

      for (const serverItem of serverItems) {
        const localItemData = QuoteItemTransform.fromServer(serverItem, userId);

        // Check if item exists by serverId
        if (localItemData.serverId) {
          const existing = await db.quoteItems
            .where('serverId')
            .equals(localItemData.serverId)
            .first();

          if (existing) {
            // Update existing
            await db.quoteItems.update(existing.id!, localItemData as Partial<LocalQuoteItem>);
            const updated = await db.quoteItems.get(existing.id!);
            if (updated) localItems.push(updated);
          } else {
            // Insert new
            const id = await db.quoteItems.add(localItemData as LocalQuoteItem);
            const created = await db.quoteItems.get(id);
            if (created) localItems.push(created);
          }
        }
      }

      return {
        quote: localQuote,
        items: localItems
      };
    });
  }

  /**
   * Get all quotes with their relations (customer, user)
   * Populates customer and user from their respective tables
   */
  async getAllWithRelations(): Promise<Array<LocalQuote & {
    customer?: any;
    user?: any;
  }>> {
    const quotes = await this.getAll();

    // Populate relations
    const quotesWithRelations = await Promise.all(
      quotes.map(async (quote) => {
        const customer = await db.customers.get(quote.customerId);
        const user = await db.users.get(quote.userId);

        return {
          ...quote,
          customer,
          user
        };
      })
    );

    return quotesWithRelations;
  }

  /**
   * Get quote by ID with relations (customer, user, items)
   */
  async getByIdWithRelations(id: number): Promise<{
    quote: LocalQuote & { customer?: any; user?: any };
    items: Array<LocalQuoteItem & { product?: any }>;
  } | null> {
    const quote = await this.getById(id);
    if (!quote) {
      return null;
    }

    // Get customer and user
    const customer = await db.customers.get(quote.customerId);
    const user = await db.users.get(quote.userId);

    // Get items with products
    const items = await db.quoteItems
      .where('quoteId')
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
      quote: {
        ...quote,
        customer,
        user
      },
      items: itemsWithProducts
    };
  }

  /**
   * Get statistics about quotes
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalValue: number;
    averageQuoteValue: number;
  }> {
    const allQuotes = await this.getAll();

    const stats = {
      total: allQuotes.length,
      byStatus: {} as Record<string, number>,
      totalValue: 0,
      averageQuoteValue: 0
    };

    for (const quote of allQuotes) {
      // Count by status
      stats.byStatus[quote.status] = (stats.byStatus[quote.status] || 0) + 1;

      // Calculate value
      stats.totalValue += quote.totalAmount;
    }

    // Calculate average
    stats.averageQuoteValue = stats.total > 0
      ? Math.round((stats.totalValue / stats.total) * 100) / 100
      : 0;

    return stats;
  }
}

// Export singleton instance
export const quoteRepository = new QuoteRepository();
