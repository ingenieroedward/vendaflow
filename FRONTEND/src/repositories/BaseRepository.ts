import { Table } from 'dexie';
import { db, SyncStatus, BaseLocalModel, SyncQueueItem } from '../database/LocalDatabase';
import { createBaseModel, generateTempId } from '../database/schemas';

/**
 * Abstract base class for all repositories
 * Provides common CRUD operations with sync queue management
 */
export abstract class BaseRepository<
  TLocal extends BaseLocalModel,
  TServer,
  TCreate
> {
  protected table: Table<TLocal, number>;
  protected entityName: string;

  constructor(table: Table<TLocal, number>, entityName: string) {
    this.table = table;
    this.entityName = entityName;
  }

  // Abstract methods that must be implemented by concrete repositories
  protected abstract transformFromServer(serverData: TServer, userId?: number): Omit<TLocal, 'id'>;
  protected abstract transformToServer(localData: TLocal): Partial<TServer>;
  protected abstract validate(data: TCreate): { valid: boolean; errors: string[] };

  /**
   * Get all active (non-deleted) records
   */
  async getAll(): Promise<TLocal[]> {
    return await this.table
      .filter(item => !item.deletedAt)
      .toArray();
  }

  /**
   * Get record by local ID
   */
  async getById(id: number): Promise<TLocal | undefined> {
    const record = await this.table.get(id);
    if (record && !record.deletedAt) {
      return record;
    }
    return undefined;
  }

  /**
   * Get record by server ID
   */
  async getByServerId(serverId: number): Promise<TLocal | undefined> {
    const record = await this.table
      .where('serverId')
      .equals(serverId)
      .first();

    if (record && !record.deletedAt) {
      return record;
    }
    return undefined;
  }

  /**
   * Create a new record locally
   * Adds to sync queue for later synchronization
   */
  async createLocal(data: TCreate, userId?: number): Promise<TLocal> {
    // Validate data
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Create record with sync metadata
    const recordWithMeta = {
      ...data,
      ...createBaseModel(userId)
    } as Omit<TLocal, 'id'>;

    // Insert into table
    const id = await this.table.add(recordWithMeta as TLocal);

    // Add to sync queue
    await this.addToSyncQueue('CREATE', id);

    // Return created record
    const created = await this.table.get(id);
    if (!created) {
      throw new Error('Failed to retrieve created record');
    }

    return created;
  }

  /**
   * Update an existing record locally
   * Increments version and adds to sync queue
   */
  async updateLocal(id: number, updates: Partial<TCreate>, userId?: number): Promise<TLocal> {
    const existing = await this.table.get(id);
    if (!existing) {
      throw new Error(`${this.entityName} not found with id ${id}`);
    }

    if (existing.deletedAt) {
      throw new Error(`${this.entityName} is deleted`);
    }

    // Validate if full data provided
    if (updates && Object.keys(updates).length > 0) {
      const mergedData = { ...existing, ...updates };
      const validation = this.validate(mergedData as TCreate);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Update with incremented version
    const updateData: Partial<TLocal> = {
      ...updates,
      _syncStatus: SyncStatus.PENDING_UPDATE,
      _version: existing._version + 1,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    } as Partial<TLocal>;

    await this.table.update(id, updateData);

    // Add to sync queue
    await this.addToSyncQueue('UPDATE', id);

    // Return updated record
    const updated = await this.table.get(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated record');
    }

    return updated;
  }

  /**
   * Soft delete a record
   * Marks as deleted and adds to sync queue
   */
  async deleteLocal(id: number, userId?: number): Promise<void> {
    const existing = await this.table.get(id);
    if (!existing) {
      throw new Error(`${this.entityName} not found with id ${id}`);
    }

    if (existing.deletedAt) {
      throw new Error(`${this.entityName} is already deleted`);
    }

    // Soft delete
    await this.table.update(id, {
      deletedAt: new Date().toISOString(),
      _syncStatus: SyncStatus.PENDING_DELETE,
      _lastModifiedAt: Date.now(),
      _lastModifiedBy: userId
    } as Partial<TLocal>);

    // Add to sync queue
    await this.addToSyncQueue('DELETE', id);
  }

  /**
   * Save data from server to local database
   * Performs upsert (update if exists, insert if not)
   */
  async saveFromServer(serverData: TServer, userId?: number): Promise<TLocal> {
    const localData = this.transformFromServer(serverData, userId);

    // Check if record exists by serverId
    if (localData.serverId) {
      const existing = await this.table
        .where('serverId')
        .equals(localData.serverId)
        .first();

      if (existing) {
        // Update existing record
        await this.table.update(existing.id!, localData as Partial<TLocal>);
        const updated = await this.table.get(existing.id!);
        if (!updated) {
          throw new Error('Failed to retrieve updated record');
        }
        return updated;
      }
    }

    // Insert new record
    const id = await this.table.add(localData as TLocal);
    const created = await this.table.get(id);
    if (!created) {
      throw new Error('Failed to retrieve created record');
    }

    return created;
  }

  /**
   * Bulk save from server
   */
  async saveAllFromServer(serverDataArray: TServer[], userId?: number): Promise<TLocal[]> {
    const results: TLocal[] = [];

    for (const serverData of serverDataArray) {
      const result = await this.saveFromServer(serverData, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get all records that need synchronization
   */
  async getUnsyncedRecords(): Promise<TLocal[]> {
    return await this.table
      .filter(item => item._syncStatus !== SyncStatus.SYNCED)
      .toArray();
  }

  /**
   * Mark a record as synced
   */
  async markAsSynced(id: number, serverId?: number): Promise<void> {
    const updates: Partial<TLocal> = {
      _syncStatus: SyncStatus.SYNCED
    } as Partial<TLocal>;

    if (serverId) {
      updates.serverId = serverId;
    }

    await this.table.update(id, updates);
  }

  /**
   * Add operation to sync queue
   */
  protected async addToSyncQueue(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    recordId: number
  ): Promise<void> {
    // Normalizar entityType a minúsculas para coincidir con el schema de IndexedDB
    const entityType = this.entityName.toLowerCase().replace(' ', '_') as SyncQueueItem['entityType'];

    const queueItem: Omit<SyncQueueItem, 'id'> = {
      entityType,
      entityLocalId: recordId,
      operation: operation.toLowerCase() as SyncQueueItem['operation'],
      data: {},
      attempts: 0,
      createdAt: Date.now(),
    };

    await db.syncQueue.add(queueItem as SyncQueueItem);
  }

  /**
   * Remove operation from sync queue
   */
  protected async removeFromSyncQueue(recordId: number): Promise<void> {
    const entityType = this.entityName.toLowerCase().replace(' ', '_');
    const queueItems = await db.syncQueue
      .where('entityLocalId')
      .equals(recordId)
      .filter(item => item.entityType === entityType)
      .toArray();

    for (const item of queueItems) {
      if (item.id) {
        await db.syncQueue.delete(item.id);
      }
    }
  }

  /**
   * Get count of records
   */
  async count(): Promise<number> {
    return await this.table
      .filter(item => !item.deletedAt)
      .count();
  }

  /**
   * Clear all records (use with caution)
   */
  async clearAll(): Promise<void> {
    await this.table.clear();
  }
}
