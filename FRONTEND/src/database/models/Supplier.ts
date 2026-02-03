import { LocalSupplier } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

// Type del servidor
export type ServerSupplier = ServerModel<LocalSupplier>;

// Type para crear proveedor
export type CreateSupplierDTO = CreateModel<LocalSupplier>;

// Validaciones
export const SupplierValidation = {
  validateName: (name: string): boolean => {
    return name.length >= 2 && name.length <= 200;
  },

  validateContact: (contact: string): boolean => {
    return contact.length >= 3 && contact.length <= 100;
  },

  validateLocation: (location: string): boolean => {
    return location.length >= 2 && location.length <= 200;
  },

  validate: (supplier: CreateSupplierDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!SupplierValidation.validateName(supplier.name)) {
      errors.push('Name must be 2-200 characters');
    }

    if (!SupplierValidation.validateContact(supplier.contact)) {
      errors.push('Contact must be 3-100 characters');
    }

    if (!SupplierValidation.validateLocation(supplier.location)) {
      errors.push('Location must be 2-200 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de transformación
export const SupplierTransform = {
  // Convertir datos del servidor a modelo local
  fromServer: (serverSupplier: ServerSupplier, userId?: number): Omit<LocalSupplier, 'id'> => {
    return {
      serverId: serverSupplier.id,
      name: serverSupplier.name,
      contact: serverSupplier.contact,
      location: serverSupplier.location,
      createdAt: serverSupplier.createdAt,
      updatedAt: serverSupplier.updatedAt,
      deletedAt: serverSupplier.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  // Convertir modelo local a datos del servidor (para sync)
  toServer: (localSupplier: LocalSupplier): Partial<ServerSupplier> => {
    const serverData: any = {
      name: localSupplier.name,
      contact: localSupplier.contact,
      location: localSupplier.location
    };

    // Incluir serverId si existe (para updates)
    if (localSupplier.serverId) {
      serverData.id = localSupplier.serverId;
    }

    return serverData;
  }
};

// Helpers de queries
export const SupplierQueries = {
  // Query para proveedores no eliminados
  activeSuppliersQuery: () => {
    return (supplier: LocalSupplier) => !supplier.deletedAt;
  },

  // Query para proveedores que necesitan sync
  unsyncedQuery: () => {
    return (supplier: LocalSupplier) => supplier._syncStatus !== 'synced';
  },

  // Query para buscar por nombre o ubicación
  searchQuery: (searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    return (supplier: LocalSupplier) =>
      supplier.name.toLowerCase().includes(term) ||
      supplier.location.toLowerCase().includes(term);
  }
};
