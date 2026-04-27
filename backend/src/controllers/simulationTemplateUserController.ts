import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as simulationTemplateService from '../services/simulationTemplateService.js';
import { CreateSimulationRequest, UpdateSimulationRequest } from '../types/index.js';

function validateCreateBody(data: CreateSimulationRequest): string | null {
  if (!data.title?.trim()) return 'Title is required';
  if (data.simulation_type) {
    if (!data.description?.trim()) {
      return 'Description (what this simulation is) is required when using simulation type';
    }
  } else if (!data.system_prompt?.trim()) {
    return 'Either system_prompt or simulation_type with description is required';
  }
  return null;
}

export async function getMine(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const list = await simulationTemplateService.getMine(req.userId);
    res.json(list);
  } catch (error) {
    next(error);
  }
}

export async function getLibrary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const list = await simulationTemplateService.getLibrary(req.userId);
    res.json(list);
  } catch (error) {
    next(error);
  }
}

export async function getStarred(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const list = await simulationTemplateService.getStarred(req.userId);
    res.json(list);
  } catch (error) {
    next(error);
  }
}

export async function getTemplateById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const simulation = await simulationTemplateService.getSimulationByIdForUser(id, req.userId);
    if (!simulation) {
      return res.status(404).json({ error: 'Simulation not found' });
    }
    res.json(simulation);
  } catch (error) {
    next(error);
  }
}

export async function createUserTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = req.body as CreateSimulationRequest;
    const err = validateCreateBody(data);
    if (err) return res.status(400).json({ error: err });
    const simulation = await simulationTemplateService.createSimulationForUser(req.userId, data);
    res.status(201).json(simulation);
  } catch (error) {
    next(error);
  }
}

export async function updateUserTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const data = req.body as UpdateSimulationRequest;
    const simulation = await simulationTemplateService.updateSimulation(id, data, {
      userId: req.userId,
      isAdmin: false,
    });
    if (!simulation) {
      return res.status(404).json({ error: 'Simulation not found or not allowed' });
    }
    res.json(simulation);
  } catch (error) {
    next(error);
  }
}

export async function deleteUserTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const deleted = await simulationTemplateService.deleteSimulation(id, {
      userId: req.userId,
      isAdmin: false,
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Simulation not found or not allowed' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function previewSystemPromptUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = req.body as CreateSimulationRequest;
    const systemPrompt = simulationTemplateService.buildSystemPromptFromConfig(data);
    res.json({ system_prompt: systemPrompt });
  } catch (error) {
    next(error);
  }
}

export async function starTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    try {
      await simulationTemplateService.starSimulation(req.userId, id);
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404) {
        return res.status(404).json({ error: 'Simulation not found or not accessible' });
      }
      throw e;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function unstarTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    await simulationTemplateService.unstarSimulation(req.userId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
