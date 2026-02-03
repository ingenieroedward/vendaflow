import { SyncStatus } from '../LocalDatabase';

// Type para datos que vienen del servidor (sin campos de sync)
export type ServerModel<T> = Omit<T,
  | '_syncStatus'
  | '_version'
  | '_lastModifiedAt'
  | '_lastModifiedBy'
  | 'id' // ID local no existe en servidor
> & {
  id: number; // serverId en el servidor
};

// Type para crear un modelo (sin campos autogenerados)
export type CreateModel<T> = Omit<T,
  | 'id'
  | 'serverId'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | '_syncStatus'
  | '_version'
  | '_lastModifiedAt'
  | '_lastModifiedBy'
>;

// Type para actualizar un modelo (campos opcionales)
export type UpdateModel<T> = Partial<CreateModel<T>>;

// Response del servidor en operaciones sync
export interface SyncResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  serverId?: number; // Para registros nuevos creados
}

// Metadata de sincronización
export interface SyncMetadata {
  lastSyncAt: number;
  lastPullAt: number;
  lastPushAt: number;
  pendingOperations: number;
  conflicts: number;
}
