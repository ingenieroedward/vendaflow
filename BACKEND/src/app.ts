import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { errorHandler, notFoundHandler } from '@/core/middlewares/errorHandler';
import { httpLogger, requestLogger, errorLogger } from '@/core/middlewares/logger';

// Import routes
import userRoutes from '@/modules/user/user.routes';
import authRoutes from '@/modules/auth/auth.routes';
import categoryRoutes from '@/modules/category/category.routes';
import productRoutes from '@/modules/product/product.routes';
import supplierRoutes from '@/modules/supplier/supplier.routes';
import priceRoutes from '@/modules/price/price.routes';
import customerRoutes from '@/modules/customer/customer.routes';
import orderRoutes from '@/modules/order/order.routes';
import pushRoutes from '@/modules/push/push.routes';
import purchaseOrderRoutes from '@/modules/purchase-order/purchase-order.routes';
import stockMovementRoutes from '@/modules/stock-movement/stock-movement.routes';
import tenantRoutes from '@/modules/tenant/tenant.routes';
import onboardingRoutes from '@/modules/tenant/onboarding.routes';
import manifestRoutes from '@/modules/tenant/manifest.routes';

const app = express();

// Confiar en el proxy de Traefik (necesario para rate-limit con X-Forwarded-For)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration — acepta orígenes estáticos + wildcard de subdominio
// CORS_WILDCARD_ORIGIN=*.merco.edwsystem.com → suffix = ".merco.edwsystem.com"
const CORS_WILDCARD_SUFFIX = (process.env['CORS_WILDCARD_ORIGIN'] || '').replace(/^\*/, '');
app.use(cors({
  origin: (origin, callback) => {
    // Peticiones sin origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Lista estática de orígenes permitidos
    if (config.cors.origin.includes(origin)) return callback(null, true);
    // Wildcard: *.merco.edwsystem.com → cualquier origen que termine en .merco.edwsystem.com
    if (CORS_WILDCARD_SUFFIX && origin.endsWith(CORS_WILDCARD_SUFFIX)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Logging middleware
app.use(httpLogger);
app.use(requestLogger);

// Rate limiting - solo en rutas de autenticación (anti fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos por IP cada 15 min
  message: {
    status: 'error',
    message: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos.',
  },
  skipSuccessfulRequests: true, // no cuenta los logins exitosos
});


// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/manifest', manifestRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error logging middleware
app.use(errorLogger);

// Global error handler (must be last)
app.use(errorHandler);

export default app; 