import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { parseVoiceIntent, ruleBasedIntent, type VoiceIntentRequest } from '../services/voiceIntentService.js';

function parseIntentBody(body: Partial<VoiceIntentRequest>): VoiceIntentRequest | null {
  if (!body.transcript || typeof body.transcript !== 'string') return null;
  if (!body.context || typeof body.context !== 'object') return null;
  if (typeof body.uiMapPrompt !== 'string') return null;
  return {
    transcript: body.transcript.trim(),
    context: {
      pathname: String(body.context.pathname || ''),
      search: String(body.context.search || ''),
      isAuthenticated: !!body.context.isAuthenticated,
      isAdmin: !!body.context.isAdmin,
      visibleTargets: Array.isArray(body.context.visibleTargets) ? body.context.visibleTargets : [],
      currentNodeId: body.context.currentNodeId ?? null,
      activeGoal: body.context.activeGoal ?? null,
    },
    uiMapPrompt: body.uiMapPrompt,
  };
}

export async function intentPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseIntentBody(req.body as Partial<VoiceIntentRequest>);
    if (!parsed) {
      return res.status(400).json({ error: 'transcript, context, and uiMapPrompt are required' });
    }
    const payload: VoiceIntentRequest = {
      ...parsed,
      context: {
        ...parsed.context,
        isAuthenticated: false,
        isAdmin: false,
        activeGoal: null,
      },
    };
    try {
      const intent = await parseVoiceIntent(payload);
      return res.json(intent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('GEMINI_API_KEY')) {
        const fallback = ruleBasedIntent(payload.transcript, payload.context);
        return res.json(fallback);
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

export async function intent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = parseIntentBody(req.body as Partial<VoiceIntentRequest>);
    if (!parsed) {
      return res.status(400).json({ error: 'transcript, context, and uiMapPrompt are required' });
    }
    const payload = parsed;

    try {
      const intent = await parseVoiceIntent(payload);
      return res.json(intent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('GEMINI_API_KEY')) {
        const fallback = ruleBasedIntent(payload.transcript, payload.context);
        return res.json(fallback);
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}
