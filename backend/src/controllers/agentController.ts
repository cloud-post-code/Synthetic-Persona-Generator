import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { runAgentTurn } from '../services/agentService.js';
import { indexSessionContext, retrieve as retrieveChunks } from '../services/embeddingService.js';

export async function turn(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { personaId, personaIds, sessionId, history, userMessage, simulationInstructions, image, mimeType } = req.body;

    if (!personaId || !userMessage) {
      return res.status(400).json({ error: 'personaId and userMessage are required' });
    }

    const result = await runAgentTurn({
      personaId,
      personaIds: personaIds || [personaId],
      sessionId: sessionId || undefined,
      history: Array.isArray(history) ? history : [],
      userMessage,
      simulationInstructions: simulationInstructions || undefined,
      image: image || undefined,
      mimeType: mimeType || undefined,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function indexContext(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { sessionId, fields } = req.body;

    if (!sessionId || !fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'sessionId and fields are required' });
    }

    await indexSessionContext(sessionId, fields);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function retrieveContext(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { query, personaIds, sessionId, topK } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const chunks = await retrieveChunks(
      query,
      Array.isArray(personaIds) ? personaIds : [],
      sessionId || undefined,
      typeof topK === 'number' ? topK : 10,
    );

    res.json({ chunks });
  } catch (error) {
    next(error);
  }
}
