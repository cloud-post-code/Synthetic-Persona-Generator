import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as simulationService from '../services/simulationService.js';
import { SimulationSession } from '../types/index.js';

export async function getSimulationSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sessions = await simulationService.getSimulationSessionsByUserId(req.userId!);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

export async function getSimulationSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const session = await simulationService.getSimulationSessionById(id, req.userId!);
    
    if (!session) {
      return res.status(404).json({ error: 'Simulation session not found' });
    }
    
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function createSimulationSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sessionData: Omit<SimulationSession, 'id' | 'user_id' | 'created_at' | 'updated_at'> = req.body;
    
    // Validate required fields (bg_info can be empty string, but must be present)
    if (!sessionData.persona_id || !sessionData.mode || sessionData.bg_info === undefined || sessionData.bg_info === null || !sessionData.name) {
      console.error('Validation failed. Received data:', {
        persona_id: sessionData.persona_id,
        mode: sessionData.mode,
        bg_info: sessionData.bg_info,
        name: sessionData.name,
        fullBody: req.body
      });
      return res.status(400).json({ error: 'persona_id, mode, bg_info, and name are required' });
    }

    const session = await simulationService.createSimulationSession(req.userId!, sessionData);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

export async function updateSimulationSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updates: Partial<SimulationSession> = req.body;
    
    const session = await simulationService.updateSimulationSession(id, req.userId!, updates);
    
    if (!session) {
      return res.status(404).json({ error: 'Simulation session not found' });
    }
    
    res.json(session);
  } catch (error) {
    next(error);
  }
}

export async function deleteSimulationSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const deleted = await simulationService.deleteSimulationSession(id, req.userId!);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Simulation session not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

