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
        if (process.env['NODE_ENV'] === 'production') {
          throw new Error('JWT_SECRET environment variable must be set in production');
        }
        return 'dev_jwt_secret_change_in_production';
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
      const escaped = w.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^.]+');
      return new RegExp(`^https?://${escaped}$`);
    })(),
  },

  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] || 'debug',
    maxFiles: process.env['LOG_MAX_FILES'] || '14d',
    maxSize: process.env['LOG_MAX_SIZE'] || '20m',
  },

  // VAPID (Web Push)
  vapid: {
    publicKey: process.env['VAPID_PUBLIC_KEY'] || '',
    privateKey: process.env['VAPID_PRIVATE_KEY'] || '',
    subject: process.env['VAPID_SUBJECT'] || 'mailto:admin@edwsystem.com',
  },
};

export default config; 