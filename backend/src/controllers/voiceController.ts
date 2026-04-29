import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { parseVoiceIntent, ruleBasedIntent, type VoiceIntentRequest } from '../services/voiceIntentService.js';

export async function intent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as Partial<VoiceIntentRequest>;
    if (!body.transcript || typeof body.transcript !== 'string') {
      return res.status(400).json({ error: 'transcript is required' });
    }
    if (!body.context || typeof body.context !== 'object') {
      return res.status(400).json({ error: 'context is required' });
    }
    if (typeof body.uiMapPrompt !== 'string') {
      return res.status(400).json({ error: 'uiMapPrompt is required' });
    }

    const payload: VoiceIntentRequest = {
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
