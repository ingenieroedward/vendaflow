import { LocalPrice } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

// Type del servidor
export type ServerPrice = ServerModel<LocalPrice>;

// Type para crear precio
export type CreatePriceDTO = CreateModel<LocalPrice>;

// Validaciones
export const PriceValidation = {
  validatePrice: (price: number): boolean => {
    return price >= 0 && price <= 9999999.99;
  },

  validateProductId: (productId: number): boolean => {
    return Number.isInteger(productId) && productId > 0;
  },

  validateSupplierId: (supplierId: number): boolean => {
    return Number.isInteger(supplierId) && supplierId > 0;
  },

  validateUpdatedByUserId: (userId: number): boolean => {
    return Number.isInteger(userId) && userId > 0;
  },

  validate: (price: CreatePriceDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!PriceValidation.validateProductId(price.productId)) {
      errors.push('Valid product ID is required');
    }

    if (!PriceValidation.validateSupplierId(price.supplierId)) {
      errors.push('Valid supplier ID is required');
    }

    if (!PriceValidation.validatePrice(price.price)) {
      errors.push('Price must be between 0 and 9999999.99');
    }

    if (!PriceValidation.validateUpdatedByUserId(price.updatedByUserId)) {
      errors.push('Valid user ID is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de transformación
export const PriceTransform = {
  // Convertir datos del servidor a modelo local
  fromServer: (serverPrice: ServerPrice, userId?: number): Omit<LocalPrice, 'id'> => {
    return {
      serverId: serverPrice.id,
      productId: serverPrice.productId ?? (serverPrice as any).product?.id,
      // El backend a veces devuelve supplierId: null pero sí incluye supplier.id
      supplierId: serverPrice.supplierId ?? (serverPrice as any).supplier?.id,
      price: serverPrice.price,
      updatedByUserId: serverPrice.updatedByUserId,
      createdAt: serverPrice.createdAt,
      updatedAt: serverPrice.updatedAt,
      deletedAt: serverPrice.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  // Convertir modelo local a datos del servidor (para sync)
  toServer: (localPrice: LocalPrice): Partial<ServerPrice> => {
    const serverData: any = {
      productId: localPrice.productId,
      supplierId: localPrice.supplierId,
      price: localPrice.price,
      updatedByUserId: localPrice.updatedByUserId
    };

    // Incluir serverId si existe (para updates)
    if (localPrice.serverId) {
      serverData.id = localPrice.serverId;
    }

    return serverData;
  }
};

// Helpers de queries
export const PriceQueries = {
  // Query para precios no eliminados
  activePricesQuery: () => {
    return (price: LocalPrice) => !price.deletedAt;
  },

  // Query para precios que necesitan sync
  unsyncedQuery: () => {
    return (price: LocalPrice) => price._syncStatus !== 'synced';
  },

  // Query para precios de un producto específico
  byProductQuery: (productId: number) => {
    return (price: LocalPrice) => price.productId === productId && !price.deletedAt;
  },

  // Query para precios de un proveedor específico
  bySupplierQuery: (supplierId: number) => {
    return (price: LocalPrice) => price.supplierId === supplierId && !price.deletedAt;
  },

  // Query para precios de un producto y proveedor específicos
  byProductAndSupplierQuery: (productId: number, supplierId: number) => {
    return (price: LocalPrice) =>
      price.productId === productId &&
      price.supplierId === supplierId &&
      !price.deletedAt;
  }
};

// Helpers de comparación de precios
export const PriceComparison = {
  // Encontrar el precio más bajo entre varios precios
  findLowestPrice: (prices: LocalPrice[]): LocalPrice | null => {
    if (prices.length === 0) return null;

    return prices.reduce((lowest, current) =>
      current.price < lowest.price ? current : lowest
    );
  },

  // Encontrar el precio más alto entre varios precios
  findHighestPrice: (prices: LocalPrice[]): LocalPrice | null => {
    if (prices.length === 0) return null;

    return prices.reduce((highest, current) =>
      current.price > highest.price ? current : highest
    );
  },

  // Calcular precio promedio
  calculateAveragePrice: (prices: LocalPrice[]): number => {
    if (prices.length === 0) return 0;

    const total = prices.reduce((sum, price) => sum + price.price, 0);
    return Math.round((total / prices.length) * 100) / 100;
  },

  // Calcular diferencia porcentual entre dos precios
  calculatePriceDifference: (price1: number, price2: number): number => {
    if (price1 === 0) return 0;

    const difference = ((price2 - price1) / price1) * 100;
    return Math.round(difference * 100) / 100;
  }
};
