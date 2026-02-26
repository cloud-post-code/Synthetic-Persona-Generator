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

  // Database connection / setup errors → return a clear message so the UI can show it
  const dbHint =
    errAny.code === 'ECONNREFUSED' || errAny.code === 'ENOTFOUND'
      ? ' Database is not running or connection settings are wrong. See SETUP_DATABASE.md.'
      : errAny.code === '28P01'
        ? ' Invalid database credentials. Check DB_USER/DB_PASSWORD (or DATABASE_URL).'
        : errAny.code === '3D000'
          ? ' Database does not exist. Create it (e.g. createdb persona_builder) and run migrations.'
          : errAny.code === '42P01'
            ? ' A required table is missing. Run: cd backend && npm run migrate'
            : '';

  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const userMessage = dbHint ? `Internal server error.${dbHint}` : 'Internal server error';

  res.status(500).json({
    error: userMessage,
    message: isDevelopment ? err.message : undefined,
    ...(isDevelopment && errAny.code && { code: errAny.code }),
    ...(isDevelopment && errAny.detail && { detail: errAny.detail }),
    stack: isDevelopment ? err.stack : undefined,
  });
}

