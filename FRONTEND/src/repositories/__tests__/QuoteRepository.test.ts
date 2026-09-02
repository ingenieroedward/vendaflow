/**
 * QuoteRepository Tests
 *
 * Mirror (recortado) de OrderRepository.test.ts — un caso representativo por
 * método en vez de cada variante, ya que QuoteRepository reusa el mismo
 * BaseRepository/transacciones Dexie ya cubiertos ahí. Sin descuento de
 * stock (una cotización no es una venta concretada).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { quoteRepository } from '../QuoteRepository';
import { db, SyncStatus } from '../../database/LocalDatabase';
import { CreateQuoteWithItemsDTO } from '../../database/models';

describe('QuoteRepository', () => {
  const testUserId = 1;
  const testCustomerId = 1;

  beforeEach(async () => {
    await db.quotes.clear();
    await db.quoteItems.clear();
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    await db.quotes.clear();
    await db.quoteItems.clear();
    await db.syncQueue.clear();
  });

  describe('createQuoteWithItems', () => {
    it('should create quote with items in a transaction', async () => {
      const quoteData: CreateQuoteWithItemsDTO = {
        quote: {
          quoteNumber: 'COT-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 1190,
          status: 'draft',
          notes: 'Test quote'
        },
        items: [
          { productId: 1, quantity: 10, unitPrice: 100, taxRate: 19, totalPrice: 1190 }
        ]
      };

      const result = await quoteRepository.createQuoteWithItems(quoteData, testUserId);

      expect(result.quote).toBeDefined();
      expect(result.quote.quoteNumber).toBe('COT-001');
      expect(result.quote.totalAmount).toBe(1190);
      expect(result.quote._syncStatus).toBe(SyncStatus.PENDING_CREATE);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(1);

      const syncQueueEntries = await db.syncQueue.toArray();
      expect(syncQueueEntries.length).toBeGreaterThanOrEqual(2); // Cotización + al menos 1 item
    });

    it('should validate quote data', async () => {
      const invalidData: CreateQuoteWithItemsDTO = {
        quote: {
          quoteNumber: '', // Inválido: vacío
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 0,
          status: 'draft'
        },
        items: []
      };

      await expect(
        quoteRepository.createQuoteWithItems(invalidData, testUserId)
      ).rejects.toThrow('Quote validation failed');
    });

    it('should validate that quote total matches sum of items', async () => {
      const mismatched: CreateQuoteWithItemsDTO = {
        quote: {
          quoteNumber: 'COT-001',
          customerId: testCustomerId,
          userId: testUserId,
          totalAmount: 9999, // No coincide con la suma de items
          status: 'draft'
        },
        items: [
          { productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }
        ]
      };

      await expect(
        quoteRepository.createQuoteWithItems(mismatched, testUserId)
      ).rejects.toThrow('does not match sum of items');
    });
  });

  describe('updateQuoteWithItems', () => {
    it('should update quote and replace items', async () => {
      const created = await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      const result = await quoteRepository.updateQuoteWithItems(
        created.quote.id!,
        { notes: 'Actualizada' },
        [{ productId: 2, quantity: 2, unitPrice: 50, taxRate: 0, totalPrice: 100 }],
        testUserId,
      );

      expect(result.quote.notes).toBe('Actualizada');
      expect(result.quote._syncStatus).toBe(SyncStatus.PENDING_UPDATE);
      expect(result.quote._version).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(2);

      // El item viejo quedó soft-deleted, no aparece en getQuoteWithItems
      const withItems = await quoteRepository.getQuoteWithItems(created.quote.id!);
      expect(withItems?.items).toHaveLength(1);
    });

    it('should throw error if quote not found', async () => {
      await expect(
        quoteRepository.updateQuoteWithItems(99999, {}, [], testUserId)
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteQuoteWithItems', () => {
    it('should soft delete quote and all items', async () => {
      const created = await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      await quoteRepository.deleteQuoteWithItems(created.quote.id!, testUserId);

      const deleted = await db.quotes.get(created.quote.id!);
      expect(deleted?.deletedAt).toBeTruthy();
      expect(deleted?._syncStatus).toBe(SyncStatus.PENDING_DELETE);

      const items = await db.quoteItems.where('quoteId').equals(created.quote.id!).toArray();
      expect(items.every(i => i.deletedAt)).toBe(true);

      // getById respeta el soft delete
      expect(await quoteRepository.getById(created.quote.id!)).toBeUndefined();
    });

    it('should throw error if quote already deleted', async () => {
      const created = await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);
      await quoteRepository.deleteQuoteWithItems(created.quote.id!, testUserId);

      await expect(
        quoteRepository.deleteQuoteWithItems(created.quote.id!, testUserId)
      ).rejects.toThrow('not found'); // getById ya no lo encuentra (soft deleted)
    });
  });

  describe('getNextQuoteNumber', () => {
    it('should return COT-001 for first quote', async () => {
      expect(await quoteRepository.getNextQuoteNumber()).toBe('COT-001');
    });

    it('should increment sequentially and pad with zeros', async () => {
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      expect(await quoteRepository.getNextQuoteNumber()).toBe('COT-002');
    });
  });

  describe('search', () => {
    it('should search by quote number, case-insensitive', async () => {
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-042', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      const results = await quoteRepository.search('cot-042');
      expect(results).toHaveLength(1);
      expect(results[0].quoteNumber).toBe('COT-042');
    });

    it('should return all quotes if search term is empty', async () => {
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      expect(await quoteRepository.search('')).toHaveLength(1);
    });
  });

  describe('getByCustomer / getByStatus', () => {
    it('should filter by customerId and by status', async () => {
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-002', customerId: 999, userId: testUserId, totalAmount: 100, status: 'sent' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      expect(await quoteRepository.getByCustomer(testCustomerId)).toHaveLength(1);
      expect(await quoteRepository.getByStatus('sent')).toHaveLength(1);
      expect(await quoteRepository.getByStatus('draft')).toHaveLength(1);
    });
  });

  describe('quoteNumberExists', () => {
    it('should detect existing numbers case-insensitively and exclude an ID', async () => {
      const created = await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);

      expect(await quoteRepository.quoteNumberExists('cot-001')).toBe(true);
      expect(await quoteRepository.quoteNumberExists('COT-999')).toBe(false);
      expect(await quoteRepository.quoteNumberExists('COT-001', created.quote.id)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct aggregate statistics', async () => {
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-001', customerId: testCustomerId, userId: testUserId, totalAmount: 100, status: 'draft' },
        items: [{ productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100 }],
      }, testUserId);
      await quoteRepository.createQuoteWithItems({
        quote: { quoteNumber: 'COT-002', customerId: testCustomerId, userId: testUserId, totalAmount: 300, status: 'sent' },
        items: [{ productId: 1, quantity: 1, unitPrice: 300, taxRate: 0, totalPrice: 300 }],
      }, testUserId);

      const stats = await quoteRepository.getStats();
      expect(stats.total).toBe(2);
      expect(stats.byStatus.draft).toBe(1);
      expect(stats.byStatus.sent).toBe(1);
      expect(stats.totalValue).toBe(400);
      expect(stats.averageQuoteValue).toBe(200);
    });
  });

  describe('saveQuoteWithItemsFromServer', () => {
    it('should upsert quote and items from server data', async () => {
      const serverQuote = {
        id: 55,
        quoteNumber: 'COT-055',
        customerId: testCustomerId,
        userId: testUserId,
        totalAmount: 100,
        status: 'draft' as const,
        notes: null,
        validUntil: null,
        convertedOrderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      const serverItems = [{
        id: 1, quoteId: 55, productId: 1, quantity: 1, unitPrice: 100, taxRate: 0, totalPrice: 100,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
      }];

      const result = await quoteRepository.saveQuoteWithItemsFromServer(serverQuote as any, serverItems as any, testUserId);

      expect(result.quote.serverId).toBe(55);
      expect(result.quote._syncStatus).toBe(SyncStatus.SYNCED);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].serverId).toBe(1);
    });
  });
});
