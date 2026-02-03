import { BaseRepository } from './BaseRepository';
import { db, LocalCustomer } from '../database/LocalDatabase';
import {
  ServerCustomer,
  CreateCustomerDTO,
  CustomerValidation,
  CustomerTransform,
  CustomerQueries
} from '../database/models';

/**
 * Repository for Customer entities
 * Handles customer management with search capabilities
 */
export class CustomerRepository extends BaseRepository<
  LocalCustomer,
  ServerCustomer,
  CreateCustomerDTO
> {
  constructor() {
    super(db.customers, 'Customer');
  }

  // Implement abstract methods from BaseRepository

  protected transformFromServer(serverData: ServerCustomer, userId?: number): Omit<LocalCustomer, 'id'> {
    return CustomerTransform.fromServer(serverData, userId);
  }

  protected transformToServer(localData: LocalCustomer): Partial<ServerCustomer> {
    return CustomerTransform.toServer(localData);
  }

  protected validate(data: CreateCustomerDTO): { valid: boolean; errors: string[] } {
    return CustomerValidation.validate(data);
  }

  // Customer-specific methods

  /**
   * Search customers by name, contact or notes
   * @param searchTerm - Term to search for (case-insensitive)
   * @returns Array of matching customers
   */
  async search(searchTerm: string): Promise<LocalCustomer[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAll();
    }

    const term = searchTerm.toLowerCase().trim();

    return await this.table
      .filter(customer =>
        !customer.deletedAt && (
          customer.name.toLowerCase().includes(term) ||
          customer.contact.toLowerCase().includes(term) ||
          (customer.note?.toLowerCase().includes(term) ?? false)
        )
      )
      .toArray();
  }

  /**
   * Search customers specifically by name
   * @param name - Name to search for
   * @returns Array of matching customers
   */
  async searchByName(name: string): Promise<LocalCustomer[]> {
    if (!name || name.trim() === '') {
      return this.getAll();
    }

    const term = name.toLowerCase().trim();

    return await this.table
      .filter(customer =>
        !customer.deletedAt &&
        customer.name.toLowerCase().includes(term)
      )
      .toArray();
  }

  /**
   * Get customers by contact information
   * @param contact - Contact to search for
   * @returns Array of matching customers
   */
  async getByContact(contact: string): Promise<LocalCustomer[]> {
    if (!contact || contact.trim() === '') {
      return [];
    }

    const term = contact.toLowerCase().trim();

    return await this.table
      .filter(customer =>
        !customer.deletedAt &&
        customer.contact.toLowerCase().includes(term)
      )
      .toArray();
  }

  /**
   * Get customers with specific note content
   * @param noteText - Text to search in notes
   * @returns Array of customers with matching notes
   */
  async searchByNotes(noteText: string): Promise<LocalCustomer[]> {
    if (!noteText || noteText.trim() === '') {
      return [];
    }

    const term = noteText.toLowerCase().trim();

    return await this.table
      .filter(customer =>
        !customer.deletedAt &&
        (customer.note?.toLowerCase().includes(term) ?? false)
      )
      .toArray();
  }

  /**
   * Get customers ordered by name alphabetically
   * @returns Array of customers sorted by name
   */
  async getAllSortedByName(): Promise<LocalCustomer[]> {
    const customers = await this.getAll();
    return customers.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Check if a customer with the same name already exists
   * @param name - Customer name to check
   * @param excludeId - Optional ID to exclude from check (for updates)
   * @returns True if customer exists
   */
  async customerNameExists(name: string, excludeId?: number): Promise<boolean> {
    const customers = await this.table
      .filter(customer =>
        customer.name.toLowerCase() === name.toLowerCase() &&
        (!excludeId || customer.id !== excludeId) &&
        !customer.deletedAt
      )
      .toArray();

    return customers.length > 0;
  }

  /**
   * Get statistics about customers
   * @returns Statistics object
   */
  async getStats(): Promise<{
    total: number;
    withNotes: number;
    synced: number;
    pendingSync: number;
  }> {
    const allCustomers = await this.getAll();

    return {
      total: allCustomers.length,
      withNotes: allCustomers.filter(c => c.note && c.note.trim() !== '').length,
      synced: allCustomers.filter(c => c._syncStatus === 'SYNCED').length,
      pendingSync: allCustomers.filter(c => c._syncStatus !== 'SYNCED').length
    };
  }
}

// Export singleton instance
export const customerRepository = new CustomerRepository();
