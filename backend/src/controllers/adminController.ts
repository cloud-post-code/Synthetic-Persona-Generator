import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as adminService from '../services/adminService.js';
import * as personaService from '../services/personaService.js';

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const users = await adminService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function getPersonas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const personas = await adminService.getAllPersonas();
    res.json(personas);
  } catch (error) {
    next(error);
  }
}

export async function getChatSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chats = await adminService.getAllChatSessions();
    res.json(chats);
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const messages = await adminService.getAllMessages();
    res.json(messages);
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await adminService.getUserStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function createPersona(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as { name: string; type: string; description?: string; avatar_url?: string };
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!body.type || !['synthetic_user', 'advisor'].includes(body.type)) {
      return res.status(400).json({ error: 'Type must be synthetic_user or advisor' });
    }
    const persona = await personaService.createGlobalPersona(req.userId!, {
      name: body.name.trim(),
      type: body.type as 'synthetic_user' | 'advisor',
      description: (body.description || '').trim() || 'Global persona',
      avatar_url: body.avatar_url || '',
    });
    res.status(201).json(persona);
  } catch (error) {
    next(error);
  }
}


