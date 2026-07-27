import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { errorHandler, notFoundHandler } from '@/core/middlewares/errorHandler';
import { httpLogger, requestLogger, errorLogger } from '@/core/middlewares/logger';
import { isAuth } from '@/core/middlewares/auth';
import { tenantScope } from '@/core/middlewares/tenantScope';

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
import assetlinksRoutes from '@/modules/tenant/assetlinks.routes';

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

// Rate limiting general — límite alto a propósito: frena scraping/abuso sin
// afectar el uso normal (búsquedas con debounce, sync offline, dashboards)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3000, // 3000 peticiones por IP cada 15 min (~3.3 req/s sostenidas)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiadas peticiones, intenta de nuevo en unos minutos.',
  },
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
    version: '1.1.0', // bump manual al cambiar algo relevante — permite verificar deploys desde fuera
  });
});

// API routes
app.use('/api', apiLimiter);

// Capa extra de defensa multi-tenant en rutas de negocio: además del filtro
// por tenantId en cada service, bloquea tenants suspendidos/cancelados.
// No aplica a: auth (login), tenants (tiene ruta pública de theming),
// onboarding (registro público), push (vapid-public-key es público),
// manifest/assetlinks (públicos por diseño).
const tenantGuard = [isAuth, tenantScope];

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', tenantGuard, userRoutes);
app.use('/api/categories', tenantGuard, categoryRoutes);
app.use('/api/products', tenantGuard, productRoutes);
app.use('/api/suppliers', tenantGuard, supplierRoutes);
app.use('/api/prices', tenantGuard, priceRoutes);
app.use('/api/customers', tenantGuard, customerRoutes);
app.use('/api/orders', tenantGuard, orderRoutes);
app.use('/api/purchase-orders', tenantGuard, purchaseOrderRoutes);
app.use('/api/stock-movements', tenantGuard, stockMovementRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/manifest', manifestRoutes);
app.use('/api/assetlinks', assetlinksRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error logging middleware
app.use(errorLogger);

// Global error handler (must be last)
app.use(errorHandler);

export default app; 