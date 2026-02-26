import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as businessProfileService from '../services/businessProfileService.js';

export async function getBusinessProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const profile = await businessProfileService.getByUserId(userId);
    if (!profile) {
      return res.json(null);
    }
    const payload = {
      ...profile,
      created_at: profile.created_at instanceof Date ? profile.created_at.toISOString() : profile.created_at,
      updated_at: profile.updated_at instanceof Date ? profile.updated_at.toISOString() : profile.updated_at,
    };
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function upsertBusinessProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const profile = await businessProfileService.upsert(userId, body);
    // Ensure JSON-serializable response (dates to ISO strings)
    const payload = {
      ...profile,
      created_at: profile.created_at instanceof Date ? profile.created_at.toISOString() : profile.created_at,
      updated_at: profile.updated_at instanceof Date ? profile.updated_at.toISOString() : profile.updated_at,
    };
    res.json(payload);
  } catch (error) {
    next(error);
  }
}
