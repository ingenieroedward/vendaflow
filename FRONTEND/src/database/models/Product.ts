import { LocalProduct } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

// Type del servidor
export type ServerProduct = ServerModel<LocalProduct>;

// Type para crear producto
export type CreateProductDTO = CreateModel<LocalProduct>;

// Validaciones
export const ProductValidation = {
  validateName: (name: string): boolean => {
    return name.length >= 3 && name.length <= 200;
  },

  validateCode: (code: string): boolean => {
    return /^[A-Z0-9-_]{2,50}$/i.test(code);
  },

  validateSalePrice: (price: number): boolean => {
    return price >= 0 && price <= 999999.99;
  },

  validateUnit: (unit: string): boolean => {
    const validUnits = ['pcs', 'kg', 'lbs', 'm', 'cm', 'l', 'ml', 'box', 'pack'];
    return validUnits.includes(unit.toLowerCase()) || unit.length <= 20;
  },

  validate: (product: CreateProductDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!ProductValidation.validateName(product.name)) {
      errors.push('Name must be 3-200 characters');
    }

    if (!ProductValidation.validateCode(product.code)) {
      errors.push('Code must be alphanumeric 2-50 characters');
    }

    if (!ProductValidation.validateSalePrice(product.salePrice)) {
      errors.push('Sale price must be 0-999999.99');
    }

    if (!ProductValidation.validateUnit(product.unit)) {
      errors.push('Invalid unit');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de transformación
export const ProductTransform = {
  // Convertir datos del servidor a modelo local
  fromServer: (serverProduct: ServerProduct, userId?: number): Omit<LocalProduct, 'id'> => {
    return {
      serverId: serverProduct.id,
      name: serverProduct.name,
      code: serverProduct.code,
      unit: serverProduct.unit,
      salePrice: serverProduct.salePrice,
      categoryId: serverProduct.categoryId,
      createdAt: serverProduct.createdAt,
      updatedAt: serverProduct.updatedAt,
      deletedAt: serverProduct.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  // Convertir modelo local a datos del servidor (para sync)
  toServer: (localProduct: LocalProduct): Partial<ServerProduct> => {
    const serverData: any = {
      name: localProduct.name,
      code: localProduct.code,
      unit: localProduct.unit,
      salePrice: localProduct.salePrice,
      categoryId: localProduct.categoryId
    };

    // Incluir serverId si existe (para updates)
    if (localProduct.serverId) {
      serverData.id = localProduct.serverId;
    }

    return serverData;
  }
};

// Helpers de queries
export const ProductQueries = {
  // Query para productos no eliminados
  activeProductsQuery: () => {
    return (product: LocalProduct) => !product.deletedAt;
  },

  // Query para productos que necesitan sync
  unsyncedQuery: () => {
    return (product: LocalProduct) => product._syncStatus !== 'synced';
  }
};
