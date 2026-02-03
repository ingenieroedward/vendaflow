import { SyncStatus } from '../LocalDatabase';

// Constantes
export const DB_VERSION = 1;
export const DB_NAME = 'JJLM_Database';

// Helpers para crear modelos base
export function createBaseModel(userId?: number): {
  _syncStatus: SyncStatus;
  _version: number;
  _lastModifiedAt: number;
  _lastModifiedBy?: number;
} {
  return {
    _syncStatus: SyncStatus.PENDING_CREATE,
    _version: 1,
    _lastModifiedAt: Date.now(),
    _lastModifiedBy: userId
  };
}

// Helper para verificar si un modelo necesita sincronización
export function needsSync(model: { _syncStatus: SyncStatus }): boolean {
  return model._syncStatus !== SyncStatus.SYNCED;
}

// Helper para generar IDs temporales (negativos)
export function generateTempId(): number {
  return -Date.now();
}
