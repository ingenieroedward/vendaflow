import { LocalCustomer } from '../LocalDatabase';
import { ServerModel, CreateModel } from '../types';

// Type del servidor
export type ServerCustomer = ServerModel<LocalCustomer>;

// Type para crear cliente
export type CreateCustomerDTO = CreateModel<LocalCustomer>;

// Validaciones
export const CustomerValidation = {
  validateName: (name: string): boolean => {
    return name.length >= 2 && name.length <= 200;
  },

  validateContact: (contact: string): boolean => {
    // Validar que tenga al menos 3 caracteres
    return contact.length >= 3 && contact.length <= 100;
  },

  validateAddress: (address: string): boolean => {
    return address.length >= 5 && address.length <= 500;
  },

  validate: (customer: CreateCustomerDTO): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!CustomerValidation.validateName(customer.name)) {
      errors.push('Name must be 2-200 characters');
    }

    if (!CustomerValidation.validateContact(customer.contact)) {
      errors.push('Contact must be 3-100 characters');
    }

    if (!CustomerValidation.validateAddress(customer.address)) {
      errors.push('Address must be 5-500 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// Helpers de transformación
export const CustomerTransform = {
  // Convertir datos del servidor a modelo local
  fromServer: (serverCustomer: ServerCustomer, userId?: number): Omit<LocalCustomer, 'id'> => {
    return {
      serverId: serverCustomer.id,
      name: serverCustomer.name,
      nit: (serverCustomer as any).nit ?? null,
      contact: serverCustomer.contact,
      address: serverCustomer.address,
      note: serverCustomer.note,
      createdAt: serverCustomer.createdAt,
      updatedAt: serverCustomer.updatedAt,
      deletedAt: serverCustomer.deletedAt,
      _syncStatus: 'synced' as const,
      _version: 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    };
  },

  // Convertir modelo local a datos del servidor (para sync)
  toServer: (localCustomer: LocalCustomer): Partial<ServerCustomer> => {
    const serverData: any = {
      name: localCustomer.name,
      nit: localCustomer.nit,
      contact: localCustomer.contact,
      address: localCustomer.address,
      note: localCustomer.note
    };

    // Incluir serverId si existe (para updates)
    if (localCustomer.serverId) {
      serverData.id = localCustomer.serverId;
    }

    return serverData;
  }
};

// Helpers de queries
export const CustomerQueries = {
  // Query para clientes no eliminados
  activeCustomersQuery: () => {
    return (customer: LocalCustomer) => !customer.deletedAt;
  },

  // Query para clientes que necesitan sync
  unsyncedQuery: () => {
    return (customer: LocalCustomer) => customer._syncStatus !== 'synced';
  },

  // Query para buscar por nombre o contacto
  searchQuery: (searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    return (customer: LocalCustomer) =>
      customer.name.toLowerCase().includes(term) ||
      (customer.nit?.toLowerCase().includes(term) ?? false) ||
      customer.contact.toLowerCase().includes(term) ||
      (customer.note?.toLowerCase().includes(term) ?? false);
  }
};
