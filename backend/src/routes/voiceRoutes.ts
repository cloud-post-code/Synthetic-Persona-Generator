import { Request, Response, NextFunction, Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as voiceController from '../controllers/voiceController.js';

const PUBLIC_LIMIT = 30;
const PUBLIC_WINDOW_MS = 60 * 60 * 1000;
const publicHits = new Map<string, { count: number; resetAt: number }>();

function rateLimitIntentPublic(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers['x-forwarded-for'];
  const ip =
    (typeof raw === 'string' ? raw.split(',')[0]?.trim() : Array.isArray(raw) ? raw[0] : null) ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  let bucket = publicHits.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + PUBLIC_WINDOW_MS };
    publicHits.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > PUBLIC_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  next();
}

const router = Router();
router.post('/intent-public', rateLimitIntentPublic, voiceController.intentPublic);
router.use(authenticateToken);
router.post('/intent', voiceController.intent);

export default router;
