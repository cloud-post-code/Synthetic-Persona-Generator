import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);
  console.error('Error stack:', err.stack);

  if (err.message === 'Invalid or expired token') {
    return res.status(403).json({ error: err.message });
  }

  if (err.message.includes('duplicate key')) {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  // In development, always show the error message
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : undefined,
    stack: isDevelopment ? err.stack : undefined,
  });
}

