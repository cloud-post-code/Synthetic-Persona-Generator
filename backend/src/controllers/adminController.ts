import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as adminService from '../services/adminService.js';

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

