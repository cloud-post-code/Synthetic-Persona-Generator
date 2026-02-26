import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as businessProfileService from '../services/businessProfileService.js';

export async function getBusinessProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await businessProfileService.getByUserId(req.userId!);
    if (!profile) {
      return res.json(null);
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function upsertBusinessProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await businessProfileService.upsert(req.userId!, req.body);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}
