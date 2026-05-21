import { Request, Response, NextFunction } from 'express';
import { record5xx } from '../utils/monitor';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = err.statusCode ?? 500;
  const message =
    process.env['NODE_ENV'] === 'production' && status === 500
      ? 'Internal server error.'
      : err.message;

  console.error(`[${new Date().toISOString()}] ${status} — ${err.message}`);

  if (status >= 500) {
    record5xx(req.path, err);
  }

  res.status(status).json({
    error: err.code ?? 'INTERNAL_ERROR',
    message,
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found.' });
}
