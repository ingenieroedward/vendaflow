import 'dotenv/config';

import app from './app';
import { config } from '@/config';
import { initializeDatabase, closeDatabase } from '@/database';
import sequelize from '@/database';
import { ensureSuperadmin } from '@/core/startup/ensureSuperadmin';

const PORT = config.server.port;

// Startup diagnostics — log which env vars are present (not their values)
const requiredEnvVars = ['NODE_ENV', 'PORT', 'DB_HOST', 'DB_NAME', 'JWT_SECRET', 'SUPERADMIN_PASSWORD', 'VAPID_PUBLIC_KEY'];
const envStatus = requiredEnvVars.map(k => `${k}=${process.env[k] ? '✅' : '❌'}`).join(' | ');
console.log(`[Startup] Env check: ${envStatus}`);

const startServer = async (): Promise<void> => {
  // Start HTTP server FIRST so health checks pass while DB initializes
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${config.server.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string): Promise<void> => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('✅ HTTP server closed.');
      try {
        await closeDatabase();
        console.log('✅ Database connection closed.');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
  });

  // Temporary debug endpoint — shows DB status and table list
  app.get('/api/debug/db', async (_req, res) => {
    try {
      await sequelize.authenticate();
      const [tables] = await sequelize.query('SHOW TABLES') as any;
      res.json({ status: 'connected', tables: tables.map((r: any) => Object.values(r)[0]) });
    } catch (err: any) {
      res.json({ status: 'error', errorCode: err.name, errorDetail: err.message?.substring(0, 300) });
    }
  });

  try {
    // Initialize database (with retries) AFTER server is already listening
    await initializeDatabase();

    // Ensure superadmin exists
    await ensureSuperadmin();

    console.log('✅ Database ready — all systems operational');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't exit — server is still running, will return errors for DB-dependent endpoints
  }
};

startServer();
