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

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Logging middleware
app.use(httpLogger);
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
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
  });
});

// API routes
app.use('/api', limiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/push', pushRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error logging middleware
app.use(errorLogger);

// Global error handler (must be last)
app.use(errorHandler);

export default app; 