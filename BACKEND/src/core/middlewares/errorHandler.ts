import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { config } from '@/config';
import { logError } from '@/core/logger';
import { Sentry, sentryEnabled } from '@/core/sentry';

export interface ErrorResponse {
  status: string;
  message: string;
  stack?: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Handle AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle Sequelize validation errors
  else if (error.name === 'SequelizeValidationError') {
    statusCode = 422;
    message = 'Validation Error';
  }
  // Handle Sequelize unique constraint errors
  else if (error.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Resource already exists';
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  // Handle JWT expiration
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Errores no controlados (500) → Sentry con contexto de request
  if (statusCode >= 500 && sentryEnabled) {
    Sentry.withScope(scope => {
      scope.setTag('url', req.originalUrl);
      scope.setTag('method', req.method);
      const user = (req as any).user;
      if (user) scope.setUser({ id: String(user.id), username: user.username });
      if (user?.tenantId) scope.setTag('tenantId', String(user.tenantId));
      Sentry.captureException(error);
    });
  }

  // Log the error
  logError('Error handled by middleware', error, {
    statusCode,
    message,
    url: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
  });

  const errorResponse: ErrorResponse = {
    status: 'error',
    message,
  };

  // Include stack trace in development
  if (config.server.nodeEnv === 'development' && error.stack) {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
}; 