export const DATABASE_CONFIG = {
  name: 'JJLM_Database',
  version: 1,

  // Configuración de sincronización
  syncInterval: 5 * 60 * 1000, // 5 minutos
  maxRetries: 3,
  retryDelay: 5000, // 5 segundos

  // Configuración de cache
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 horas

  // Límites
  maxQueueSize: 1000,
  batchSize: 50 // Registros por batch en sync
};
