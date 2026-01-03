import jwt from 'jsonwebtoken';

// Using || ensures these are never undefined, satisfying TypeScript
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_fallback';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const signToken = (payload: any) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};

