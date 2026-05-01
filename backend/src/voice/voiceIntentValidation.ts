import type { VoiceIntent, VoiceIntentResult } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import { isVoiceIntent } from '../types/voiceIntents.js';
import { findNodeId, getNodeById } from './uiMapData.js';

/** Single cap for /intent, /plan, and /observe replans. */
export const MAX_VOICE_BATCH_STEPS = 24;

type ValidateOpts = { skipActionTargetCheck?: boolean };

export function voiceNodeAllowed(nodeId: string | null, isAuthenticated: boolean, isAdmin: boolean): boolean {
  if (!nodeId) return true;
  const n = getNodeById(nodeId);
  if (!n) return false;
  const auth = n.prerequisites?.auth;
  if (!auth) return true;
  if (auth === 'user') return isAuthenticated;
  if (auth === 'admin') return isAuthenticated && isAdmin;
  return true;
}

function resolveNavigateTarget(path: string, query?: Record<string, string>): string | null {
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  return findNodeId(path, search);
}

export function validateIntent(
  intent: VoiceIntent,
  ctx: VoiceIntentRequest['context'],
  opts?: ValidateOpts
): VoiceIntent {
  const { isAuthenticated, isAdmin, visibleTargets, currentNodeId } = ctx;
  const targetIds = new Set(visibleTargets.map((t) => t.id));

  if (intent.type === 'navigate') {
    const toId = resolveNavigateTarget(intent.path, intent.query);
    if (!toId || !voiceNodeAllowed(toId, isAuthenticated, isAdmin)) {
      return { type: 'unsupported', reason: 'Navigation target is not allowed.' };
    }
    return intent;
  }

  if (intent.type === 'set_query') {
    const from = currentNodeId ? getNodeById(currentNodeId) : null;
    if (!from) {
      return { type: 'unsupported', reason: 'Cannot change tab here.' };
    }
    const nextSearch = new URLSearchParams(ctx.search.replace(/^\?/, ''));
    for (const [k, v] of Object.entries(intent.query)) {
      nextSearch.set(k, v);
    }
    const qs = nextSearch.toString();
    const nextId = findNodeId(ctx.pathname, qs ? `?${qs}` : '');
    if (!nextId || !voiceNodeAllowed(nextId, isAuthenticated, isAdmin)) {
      return { type: 'unsupported', reason: 'That tab or filter change is not allowed.' };
    }
    const ok = from.transitions.some((t) => t.to === nextId && t.via === 'set_query');
    if (!ok) {
      return { type: 'unsupported', reason: 'That tab change is not available on this screen.' };
    }
    return intent;
  }

  if (intent.type === 'action') {
    if (!opts?.skipActionTargetCheck && !targetIds.has(intent.target_id)) {
      return { type: 'unsupported', reason: 'That control is not visible right now.' };
    }
    return intent;
  }

  if (intent.type === 'goal_complete') {
    if (!ctx.activeGoal || ctx.activeGoal.goalId !== intent.goalId) {
      return { type: 'speak', text: 'There is no active task to complete.' };
    }
    return intent;
  }

  return intent;
}

type SimContext = VoiceIntentRequest['context'];

export function validateBatchSteps(
  rawSteps: unknown[],
  ctx: VoiceIntentRequest['context']
): VoiceIntentResult {
  if (rawSteps.length === 0) {
    return { type: 'unsupported', reason: 'Empty batch.' };
  }
  if (rawSteps.length > MAX_VOICE_BATCH_STEPS) {
    return { type: 'unsupported', reason: `At most ${MAX_VOICE_BATCH_STEPS} steps per utterance.` };
  }
  const out: VoiceIntent[] = [];
  let sim: SimContext = { ...ctx };
  let priorNavOrTab = false;

  for (const step of rawSteps) {
    if (!isVoiceIntent(step)) {
      return { type: 'unsupported', reason: 'Invalid step in batch.' };
    }
    const skipTargets = priorNavOrTab && step.type === 'action';
    const validated = validateIntent(step, sim, { skipActionTargetCheck: skipTargets });
    if (validated.type === 'unsupported') {
      return validated;
    }
    out.push(validated);

    if (validated.type === 'navigate') {
      priorNavOrTab = true;
      const search = validated.query ? `?${new URLSearchParams(validated.query).toString()}` : '';
      sim = {
        ...sim,
        pathname: validated.path,
        search,
        currentNodeId: findNodeId(validated.path, search),
      };
    } else if (validated.type === 'set_query') {
      priorNavOrTab = true;
      const sp = new URLSearchParams(sim.search.replace(/^\?/, ''));
      for (const [k, v] of Object.entries(validated.query)) {
        sp.set(k, v);
      }
      const search = sp.toString() ? `?${sp.toString()}` : '';
      sim = {
        ...sim,
        search,
        currentNodeId: findNodeId(sim.pathname, search),
      };
    }
  }

  if (out.length === 1) return out[0]!;
  return { type: 'batch', steps: out };
}
