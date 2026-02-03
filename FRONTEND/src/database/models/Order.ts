import { LocalOrder, LocalOrderItem } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

export type ServerOrder = ServerModel<LocalOrder>;
export type ServerOrderItem = ServerModel<LocalOrderItem>;
export type CreateOrderDTO = CreateModel<LocalOrder>;
export type CreateOrderItemDTO = CreateModel<LocalOrderItem>;

// DTO completo para crear orden con items
export interface CreateOrderWithItemsDTO {
  order: CreateOrderDTO;
  items: CreateOrderItemDTO[];
}

// Validaciones de orden
export const OrderValidation = {
  validateOrderNumber: (orderNumber: string): boolean => {
    return /^ORD-\d{3,}$/.test(orderNumber);
  },

  validateTotalAmount: (amount: number): boolean => {
    return amount >= 0 && amount <= 9999999.99;
  },

  validateStatus: (status: string): boolean => {
    return ['pending', 'processing', 'completed', 'cancelled'].includes(status);
  },

  validate: (order: CreateOrderDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!OrderValidation.validateOrderNumber(order.orderNumber)) {
      errors.push('Order number must follow format ORD-XXX');
    }

    if (!order.customerId) {
      errors.push('Customer is required');
    }

    if (!order.userId) {
      errors.push('User is required');
    }

    if (!OrderValidation.validateTotalAmount(order.totalAmount)) {
      errors.push('Total amount invalid');
    }

    if (!OrderValidation.validateStatus(order.status)) {
      errors.push('Invalid status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Validaciones de items
export const OrderItemValidation = {
  validateQuantity: (quantity: number): boolean => {
    return Number.isInteger(quantity) && quantity > 0 && quantity <= 999999;
  },

  validateUnitPrice: (price: number): boolean => {
    return price >= 0 && price <= 999999.99;
  },

  validateTaxRate: (rate: number): boolean => {
    return Number.isInteger(rate) && rate >= 0 && rate <= 100;
  },

  validate: (item: CreateOrderItemDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!item.productId) {
      errors.push('Product is required');
    }

    if (!OrderItemValidation.validateQuantity(item.quantity)) {
      errors.push('Quantity must be positive integer');
    }

    if (!OrderItemValidation.validateUnitPrice(item.unitPrice)) {
      errors.push('Unit price invalid');
    }

    if (!OrderItemValidation.validateTaxRate(item.taxRate)) {
      errors.push('Tax rate must be 0-100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de cálculo
export const OrderCalculations = {
  // Calcular total de un item
  calculateItemTotal: (quantity: number, unitPrice: number, taxRate: number): number => {
    const subtotal = quantity * unitPrice;
    const tax = subtotal * (taxRate / 100);
    return Math.round((subtotal + tax) * 100) / 100; // Redondear a 2 decimales
  },

  // Calcular total de la orden desde items
  calculateOrderTotal: (items: CreateOrderItemDTO[]): number => {
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return Math.round(total * 100) / 100;
  },

  // Validar que el total de la orden coincida con la suma de items
  validateOrderTotal: (orderTotal: number, items: CreateOrderItemDTO[]): boolean => {
    const calculatedTotal = OrderCalculations.calculateOrderTotal(items);
    return Math.abs(orderTotal - calculatedTotal) < 0.01; // Tolerancia de 1 centavo
  }
};

// Transformación
export const OrderTransform = {
  fromServer: (serverOrder: ServerOrder, userId?: number): Omit<LocalOrder, 'id'> => {
    return {
      serverId: serverOrder.id,
      orderNumber: serverOrder.orderNumber,
      customerId: serverOrder.customerId,
      userId: serverOrder.userId,
      totalAmount: serverOrder.totalAmount,
      status: serverOrder.status,
      notes: serverOrder.notes,
      createdAt: serverOrder.createdAt,
      updatedAt: serverOrder.updatedAt,
      deletedAt: serverOrder.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  toServer: (localOrder: LocalOrder): Partial<ServerOrder> => {
    const serverData: any = {
      orderNumber: localOrder.orderNumber,
      customerId: localOrder.customerId,
      userId: localOrder.userId,
      totalAmount: localOrder.totalAmount,
      status: localOrder.status,
      notes: localOrder.notes
    };

    if (localOrder.serverId) {
      serverData.id = localOrder.serverId;
    }

    return serverData;
  }
};

export const OrderItemTransform = {
  fromServer: (serverItem: ServerOrderItem, userId?: number): Omit<LocalOrderItem, 'id'> => {
    return {
      serverId: serverItem.id,
      orderId: serverItem.orderId,
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

  toServer: (localItem: LocalOrderItem): Partial<ServerOrderItem> => {
    const serverData: any = {
      orderId: localItem.orderId,
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
