import * as Sentry from '@sentry/node';
import { APP_VERSION } from '@/config/version';

// Monitoreo de errores 500. Se activa solo si SENTRY_DSN está en el entorno
// (Dokploy); sin DSN todas las llamadas a Sentry son no-ops.
const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    release: `merco-backend@${APP_VERSION}`,
    environment: process.env['NODE_ENV'] ?? 'production',
    // Solo captura de errores — sin tracing para no generar volumen/costo
    tracesSampleRate: 0,
  });
}

export const sentryEnabled = Boolean(dsn);
export { Sentry };
