import 'dotenv/config';
import '@/core/sentry'; // init antes que la app para capturar todo

import app from './app';
import { config } from '@/config';
import { initializeDatabase, closeDatabase } from '@/database';
import { ensureSuperadmin } from '@/core/startup/ensureSuperadmin';
import { ensureDemoData } from '@/core/startup/ensureDemoData';
import { ensureSchema } from '@/core/startup/ensureSchema';
import { startPaymentReminderJob } from '@/core/jobs/paymentReminders';
import { startTrialExpiryJob } from '@/core/jobs/trialExpiry';
import { startSubscriptionRenewalJob } from '@/core/jobs/subscriptionRenewal';

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

  try {
    // Initialize database (with retries) AFTER server is already listening
    await initializeDatabase();

    // Add any missing columns to existing tables (no migrations in this project)
    await ensureSchema();

    // Ensure superadmin exists
    await ensureSuperadmin();

    // Ensure demo tenant/user if DEMO_ADMIN_PASSWORD is set
    await ensureDemoData();

    // Daily push reminders for credit orders about to expire
    startPaymentReminderJob();

    // Daily trial management: suspend expired trials + expiry warnings
    startTrialExpiryJob();
    startSubscriptionRenewalJob();

    console.log('✅ Database ready — all systems operational');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't exit — server is still running, will return errors for DB-dependent endpoints
  }
};

startServer();
