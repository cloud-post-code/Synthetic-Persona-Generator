import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as adminService from '../services/adminService.js';
import * as personaService from '../services/personaService.js';
import pool from '../config/database.js';
import { indexPersona } from '../services/embeddingService.js';

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

export async function reindexAll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await pool.query('SELECT id, name FROM personas');
    const personas: { id: string; name: string }[] = result.rows;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const total = personas.length;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < personas.length; i++) {
      const { id, name } = personas[i];
      try {
        await indexPersona(id);
        success++;
        res.write(JSON.stringify({ type: 'progress', current: i + 1, total, personaName: name, status: 'success' }) + '\n');
      } catch (err: any) {
        failed++;
        const errorMsg = err?.message || String(err);
        console.error(`Reindex failed for persona ${id} (${name}):`, errorMsg);
        res.write(JSON.stringify({ type: 'progress', current: i + 1, total, personaName: name, status: 'error', error: errorMsg }) + '\n');
      }
    }

    res.write(JSON.stringify({ type: 'complete', success, failed, total }) + '\n');
    res.end();
    console.log(`Reindex complete: ${success} succeeded, ${failed} failed out of ${total} total`);
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      res.write(JSON.stringify({ type: 'error', error: msg }) + '\n');
      res.end();
    }
  }
}


