import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  resolveVoiceIntent,
  ruleBasedIntent,
  type VoiceIntentRequest,
} from '../services/voiceIntentService.js';
import {
  planVoiceTurn,
  MAX_BATCH_STEPS,
  MAX_REPLANS,
  MAX_PLAN_WALLCLOCK_MS,
} from '../services/voicePlannerService.js';
import { planStore, type PlanObservation } from '../services/voicePlanStore.js';
import type { VoiceIntent, VoiceIntentResult } from '../types/voiceIntents.js';

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
      const intent = await resolveVoiceIntent(payload, { userId: null });
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
      const intent = await resolveVoiceIntent(
        payload,
        { userId: req.userId ?? null },
        { username: req.username, isAdmin: payload.context.isAdmin }
      );
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

function resultToSteps(result: VoiceIntentResult): VoiceIntent[] {
  if (result.type === 'batch') return result.steps;
  return [result];
}

function isClarifyOrSpeak(steps: VoiceIntent[]): boolean {
  return steps.length === 1 && (steps[0]!.type === 'clarify' || steps[0]!.type === 'speak' || steps[0]!.type === 'unsupported' || steps[0]!.type === 'goal_complete');
}

/**
 * POST /api/voice/plan
 * Build the initial multi-step plan and stash it server-side so the executor
 * can stream observations back via /observe.
 */
export async function plan(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = parseIntentBody(req.body as Partial<VoiceIntentRequest>);
    if (!parsed) {
      return res.status(400).json({ error: 'transcript, context, and uiMapPrompt are required' });
    }
    const payload = parsed;

    let result: VoiceIntentResult;
    try {
      result = await planVoiceTurn(
        payload,
        { userId: req.userId ?? null },
        { username: req.username, isAdmin: payload.context.isAdmin }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('GEMINI_API_KEY')) {
        const fallback = ruleBasedIntent(payload.transcript, payload.context);
        return res.json({ kind: 'fallback', plan: null, result: fallback });
      }
      throw err;
    }

    const steps = resultToSteps(result);

    if (isClarifyOrSpeak(steps)) {
      return res.json({ kind: 'inline', plan: null, result: steps[0] });
    }

    const rec = planStore().create({
      userId: req.userId ?? null,
      transcript: payload.transcript,
      steps,
      request: payload,
    });
    return res.json({
      kind: 'plan',
      planId: rec.planId,
      steps: rec.steps,
      maxSteps: MAX_BATCH_STEPS,
      maxReplans: MAX_REPLANS,
      maxWallclockMs: MAX_PLAN_WALLCLOCK_MS,
    });
  } catch (error) {
    next(error);
  }
}

function parseObservation(raw: unknown): PlanObservation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.stepIndex !== 'number') return null;
  return {
    stepIndex: o.stepIndex,
    pathname: typeof o.pathname === 'string' ? o.pathname : undefined,
    currentNodeId: typeof o.currentNodeId === 'string' ? o.currentNodeId : (o.currentNodeId === null ? null : undefined),
    visibleTargetIds: Array.isArray(o.visibleTargetIds) ? (o.visibleTargetIds as unknown[]).filter((x) => typeof x === 'string').map(String) : undefined,
    summary: typeof o.summary === 'string' ? o.summary : undefined,
    validationError: typeof o.validationError === 'string' ? o.validationError : (o.validationError === null ? null : undefined),
    matched: typeof o.matched === 'boolean' ? o.matched : undefined,
    ok: typeof o.ok === 'boolean' ? o.ok : undefined,
  };
}

/**
 * POST /api/voice/observe
 * Body: { planId, observation }.
 * Returns: { action: 'continue' | 'replan' | 'done' | 'cancelled' | 'failed', steps?, reason? }.
 */
export async function observe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = (req.body || {}) as { planId?: string; observation?: unknown; latestContext?: VoiceIntentRequest['context'] };
    if (!body.planId || typeof body.planId !== 'string') {
      return res.status(400).json({ error: 'planId is required' });
    }
    const obs = parseObservation(body.observation);
    if (!obs) return res.status(400).json({ error: 'observation is required' });

    const store = planStore();
    const rec = store.get(body.planId);
    if (!rec) return res.status(404).json({ error: 'Unknown or expired planId' });
    if (rec.userId && rec.userId !== (req.userId ?? null)) {
      return res.status(403).json({ error: 'Plan belongs to another user' });
    }
    if (rec.status !== 'active') {
      return res.json({ action: rec.status === 'cancelled' ? 'cancelled' : rec.status === 'done' ? 'done' : 'failed', reason: `plan ${rec.status}` });
    }

    const wallclock = Date.now() - rec.createdAt;
    if (wallclock > MAX_PLAN_WALLCLOCK_MS) {
      store.update(rec.planId, (r) => {
        r.status = 'failed';
        r.history.push({ kind: 'failed', at: Date.now(), detail: 'wallclock exceeded' });
      });
      return res.json({ action: 'failed', reason: 'plan wallclock exceeded' });
    }

    store.update(rec.planId, (r) => {
      r.observations.push(obs);
      r.cursor = Math.max(r.cursor, obs.stepIndex + 1);
      r.history.push({ kind: 'observed', at: Date.now(), detail: `step=${obs.stepIndex} ok=${obs.ok ?? '?'} matched=${obs.matched ?? '?'}` });
    });

    const failedStep = obs.ok === false || obs.matched === false || (obs.validationError != null);
    const planFinished = rec.cursor >= rec.steps.length && !failedStep;

    if (planFinished) {
      store.update(rec.planId, (r) => {
        r.status = 'done';
        r.history.push({ kind: 'completed', at: Date.now() });
      });
      return res.json({ action: 'done' });
    }

    if (!failedStep) {
      return res.json({ action: 'continue', cursor: rec.cursor });
    }

    if (rec.replans >= MAX_REPLANS) {
      store.update(rec.planId, (r) => {
        r.status = 'failed';
        r.history.push({ kind: 'failed', at: Date.now(), detail: 'replan cap exceeded' });
      });
      return res.json({ action: 'failed', reason: 'too many replans' });
    }

    const replanRequest: VoiceIntentRequest = {
      ...rec.request,
      context: {
        ...rec.request.context,
        ...(body.latestContext ?? {}),
      },
    };

    let replan: VoiceIntentResult;
    try {
      replan = await planVoiceTurn(
        replanRequest,
        { userId: req.userId ?? null },
        { username: req.username, isAdmin: replanRequest.context.isAdmin },
        {
          replan: {
            reason: obs.validationError || obs.summary || 'Step did not produce expected outcome.',
            lastSteps: rec.steps,
            lastStepIndex: obs.stepIndex,
            recentObservations: rec.observations.slice(-4).map((o) =>
              `step=${o.stepIndex} ok=${o.ok ?? '?'} matched=${o.matched ?? '?'} err=${o.validationError ?? ''} summary=${o.summary ?? ''}`
            ),
          },
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      store.update(rec.planId, (r) => {
        r.status = 'failed';
        r.history.push({ kind: 'failed', at: Date.now(), detail: msg.slice(0, 240) });
      });
      return res.json({ action: 'failed', reason: msg });
    }

    const newSteps = resultToSteps(replan);
    if (isClarifyOrSpeak(newSteps)) {
      store.update(rec.planId, (r) => {
        r.steps = [...r.steps.slice(0, obs.stepIndex), ...newSteps];
        r.cursor = obs.stepIndex;
        r.replans += 1;
        r.history.push({ kind: 'replanned', at: Date.now(), detail: `inline ${newSteps[0]?.type}` });
      });
      return res.json({
        action: 'replan',
        steps: newSteps,
        cursor: obs.stepIndex,
        reason: 'inline clarify/speak',
      });
    }

    store.update(rec.planId, (r) => {
      r.steps = [...r.steps.slice(0, obs.stepIndex), ...newSteps];
      r.cursor = obs.stepIndex;
      r.replans += 1;
      r.history.push({ kind: 'replanned', at: Date.now(), detail: `${newSteps.length} new steps` });
    });
    return res.json({ action: 'replan', steps: newSteps, cursor: obs.stepIndex });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/voice/cancel
 * Body: { planId }.
 */
export async function cancel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = (req.body || {}) as { planId?: string };
    if (!body.planId || typeof body.planId !== 'string') {
      return res.status(400).json({ error: 'planId is required' });
    }
    const store = planStore();
    const rec = store.get(body.planId);
    if (!rec) return res.json({ ok: true, status: 'unknown' });
    if (rec.userId && rec.userId !== (req.userId ?? null)) {
      return res.status(403).json({ error: 'Plan belongs to another user' });
    }
    store.cancel(body.planId);
    return res.json({ ok: true, status: 'cancelled' });
  } catch (error) {
    next(error);
  }
}
