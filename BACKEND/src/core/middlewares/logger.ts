import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logStream, logInfo, logError } from '@/core/logger';

// Morgan middleware for HTTP request logging
export const httpLogger = morgan('combined', { stream: logStream });

// Custom logging middleware for additional request details
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request start
  logInfo('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - start;
    
    // Log response
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: (req as any).user?.id,
    };

    if (res.statusCode >= 400) {
      logError('Request failed', undefined, logData);
    } else {
      logInfo('Request completed', logData);
    }

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: Request, _res: Response, next: NextFunction): void => {
  logError('Unhandled error', error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?.id,
  });
  
  next(error);
}; 