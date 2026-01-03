import jwt from 'jsonwebtoken';

// ✅ The Fix - Explicitly handle undefined with fallbacks
const secret = process.env.JWT_SECRET || 'default_secret_do_not_use';
const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  username: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn,
  });
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

