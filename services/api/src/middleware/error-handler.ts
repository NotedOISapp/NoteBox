import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isProd } from '../config/env.js';

import { logError } from '../utils/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // Log the detailed error on the server
  logError('API Error', err);

  // If it is a Zod Validation error, return 400 Bad Request with structured details
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Input validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred';

  // SEC-011: For security in production, do not expose stack traces or internal DB/system messages
  const safeMessage = isProd && statusCode === 500
    ? 'Internal Server Error'
    : message;

  const safeError = isProd && statusCode === 500
    ? 'InternalServerError'
    : (err.name || 'InternalServerError');

  res.status(statusCode).json({
    error: safeError,
    message: safeMessage,
    ...(!isProd && { stack: err.stack }),
  });
}
