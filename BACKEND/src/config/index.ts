import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  server: {
    port: process.env['PORT'] || 3000,
    nodeEnv: process.env['NODE_ENV'] || 'development',
  },

  // Database configuration
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '3306'),
    name: process.env['DB_NAME'] || 'express_ts_db',
    user: process.env['DB_USER'] || 'root',
    password: process.env['DB_PASSWORD'] || '',
    dialect: (process.env['DB_DIALECT'] as any) || 'mysql',
  },

  // JWT configuration
  jwt: {
    secret: (() => {
      const secret = process.env['JWT_SECRET'];
      if (!secret) {
        const fallback = 'dev_jwt_secret_change_in_production';
        if (process.env['NODE_ENV'] === 'production') {
          // Log warning but don't crash — let the health check pass so logs are visible
          console.error('[CONFIG] WARNING: JWT_SECRET not set in production — using insecure fallback');
        }
        return fallback;
      }
      return secret;
    })(),
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  },

  // CORS configuration — soporta orígenes estáticos + wildcard de subdominio
  cors: {
    origin: (process.env['CORS_ORIGIN'] || 'http://localhost:3000')
      .split(',')
      .map(o => o.trim()),
    // CORS_WILDCARD_ORIGIN=*.merco.edwsystem.com → convierte a RegExp
    wildcardPattern: (() => {
      const w = process.env['CORS_WILDCARD_ORIGIN'];
      if (!w) return null;
      const escaped = w.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+');
      return new RegExp(`^https?://${escaped}$`);
    })(),
  },

  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] || 'debug',
    maxFiles: process.env['LOG_MAX_FILES'] || '14d',
    maxSize: process.env['LOG_MAX_SIZE'] || '20m',
  },

  // SaaS: registro público, promociones y enforcement de planes.
  // Los flags de enforcement están APAGADOS por defecto para no afectar
  // tenants existentes en producción — activarlos solo tras revisar sus datos.
  saas: {
    defaultTrialDays: parseInt(process.env['TRIAL_DAYS'] || '14'),
    // LAUNCH_PROMO_CODES=LANZAMIENTO:30,FUNDADOR:30 → código:días de prueba
    promoCodes: (process.env['LAUNCH_PROMO_CODES'] || 'LANZAMIENTO:30')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .reduce<Record<string, number>>((acc, entry) => {
        const [code, days] = entry.split(':');
        const parsed = parseInt(days || '', 10);
        if (code && parsed > 0) acc[code.toUpperCase()] = parsed;
        return acc;
      }, {}),
    publicSignupEnabled: process.env['PUBLIC_SIGNUP_ENABLED'] !== 'false',
    enforceTrialExpiry: process.env['ENFORCE_TRIAL_EXPIRY'] === 'true',
    enforcePlanLimits: process.env['ENFORCE_PLAN_LIMITS'] === 'true',
  },

  // VAPID (Web Push)
  vapid: {
    publicKey: process.env['VAPID_PUBLIC_KEY'] || '',
    privateKey: process.env['VAPID_PRIVATE_KEY'] || '',
    subject: process.env['VAPID_SUBJECT'] || 'mailto:admin@edwsystem.com',
  },
};

export default config; 