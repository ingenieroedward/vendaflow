import { LocalQuote, LocalQuoteItem } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

export type ServerQuote = ServerModel<LocalQuote>;
export type ServerQuoteItem = ServerModel<LocalQuoteItem>;
export type CreateQuoteDTO = CreateModel<LocalQuote>;
export type CreateQuoteItemDTO = CreateModel<LocalQuoteItem>;

// DTO completo para crear cotización con items
export interface CreateQuoteWithItemsDTO {
  quote: CreateQuoteDTO;
  items: CreateQuoteItemDTO[];
}

// Validaciones de cotización
export const QuoteValidation = {
  validateQuoteNumber: (quoteNumber: string): boolean => {
    return /^COT-\d{3,}$/.test(quoteNumber);
  },

  validateTotalAmount: (amount: number): boolean => {
    return amount >= 0 && amount <= 9999999.99;
  },

  validateStatus: (status: string): boolean => {
    return ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'].includes(status);
  },

  validate: (quote: CreateQuoteDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!QuoteValidation.validateQuoteNumber(quote.quoteNumber)) {
      errors.push('Quote number must follow format COT-XXX');
    }

    if (!quote.customerId) {
      errors.push('Customer is required');
    }

    if (!quote.userId) {
      errors.push('User is required');
    }

    if (!QuoteValidation.validateTotalAmount(quote.totalAmount)) {
      errors.push('Total amount invalid');
    }

    if (!QuoteValidation.validateStatus(quote.status)) {
      errors.push('Invalid status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Validaciones de items
export const QuoteItemValidation = {
  validateQuantity: (quantity: number): boolean => {
    return Number.isInteger(quantity) && quantity > 0 && quantity <= 999999;
  },

  validateUnitPrice: (price: number): boolean => {
    return price >= 0 && price <= 999999.99;
  },

  validateTaxRate: (rate: number): boolean => {
    return Number.isInteger(rate) && rate >= 0 && rate <= 100;
  },

  validate: (item: CreateQuoteItemDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!item.productId) {
      errors.push('Product is required');
    }

    if (!QuoteItemValidation.validateQuantity(item.quantity)) {
      errors.push('Quantity must be positive integer');
    }

    if (!QuoteItemValidation.validateUnitPrice(item.unitPrice)) {
      errors.push('Unit price invalid');
    }

    if (!QuoteItemValidation.validateTaxRate(item.taxRate)) {
      errors.push('Tax rate must be 0-100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de cálculo
export const QuoteCalculations = {
  // Calcular total de un item
  calculateItemTotal: (quantity: number, unitPrice: number, taxRate: number): number => {
    const subtotal = quantity * unitPrice;
    const tax = subtotal * (taxRate / 100);
    return Math.round((subtotal + tax) * 100) / 100; // Redondear a 2 decimales
  },

  // Calcular total de la cotización desde items
  calculateQuoteTotal: (items: CreateQuoteItemDTO[]): number => {
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return Math.round(total * 100) / 100;
  },

  // Validar que el total de la cotización coincida con la suma de items
  validateQuoteTotal: (quoteTotal: number, items: CreateQuoteItemDTO[]): boolean => {
    const calculatedTotal = QuoteCalculations.calculateQuoteTotal(items);
    return Math.abs(quoteTotal - calculatedTotal) < 0.01; // Tolerancia de 1 centavo
  }
};

// Transformación
export const QuoteTransform = {
  fromServer: (serverQuote: ServerQuote, userId?: number): Omit<LocalQuote, 'id'> => {
    return {
      serverId: serverQuote.id,
      quoteNumber: serverQuote.quoteNumber,
      customerId: serverQuote.customerId,
      userId: serverQuote.userId,
      totalAmount: serverQuote.totalAmount,
      status: serverQuote.status,
      notes: serverQuote.notes,
      validUntil: serverQuote.validUntil,
      convertedOrderId: serverQuote.convertedOrderId,
      createdAt: serverQuote.createdAt,
      updatedAt: serverQuote.updatedAt,
      deletedAt: serverQuote.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  toServer: (localQuote: LocalQuote): Partial<ServerQuote> => {
    const serverData: any = {
      quoteNumber: localQuote.quoteNumber,
      customerId: localQuote.customerId,
      userId: localQuote.userId,
      totalAmount: localQuote.totalAmount,
      status: localQuote.status,
      notes: localQuote.notes,
      validUntil: localQuote.validUntil,
    };

    if (localQuote.serverId) {
      serverData.id = localQuote.serverId;
    }

    return serverData;
  }
};

export const QuoteItemTransform = {
  fromServer: (serverItem: ServerQuoteItem, userId?: number): Omit<LocalQuoteItem, 'id'> => {
    return {
      serverId: serverItem.id,
      quoteId: serverItem.quoteId,
      productId: serverItem.productId,
      quantity: serverItem.quantity,
      unitPrice: serverItem.unitPrice,
      taxRate: serverItem.taxRate,
      totalPrice: serverItem.totalPrice,
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      deletedAt: serverItem.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  toServer: (localItem: LocalQuoteItem): Partial<ServerQuoteItem> => {
    const serverData: any = {
      quoteId: localItem.quoteId,
      productId: localItem.productId,
      quantity: localItem.quantity,
      unitPrice: localItem.unitPrice,
      taxRate: localItem.taxRate,
      totalPrice: localItem.totalPrice
    };

    if (localItem.serverId) {
      serverData.id = localItem.serverId;
    }

    return serverData;
  }
};
