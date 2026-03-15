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
    secret: process.env['JWT_SECRET'] || 'your_jwt_secret_key_here',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'),
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  },

  // CORS configuration
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
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
    subject: process.env['VAPID_SUBJECT'] || 'mailto:admin@jjlm.com',
  },
};

export default config; 