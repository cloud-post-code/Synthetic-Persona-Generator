import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errAny = err as Error & { code?: string; detail?: string };
  console.error('Error:', err.message);
  console.error('Error stack:', err.stack);
  if (errAny.code) console.error('PG code:', errAny.code);
  if (errAny.detail) console.error('PG detail:', errAny.detail);

  if (err.message === 'Invalid or expired token') {
    return res.status(403).json({ error: err.message });
  }

  if (err.message.includes('duplicate key')) {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  // In development, always show the error message and PG details
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : undefined,
    ...(isDevelopment && errAny.code && { code: errAny.code }),
    ...(isDevelopment && errAny.detail && { detail: errAny.detail }),
    stack: isDevelopment ? err.stack : undefined,
  });
}

