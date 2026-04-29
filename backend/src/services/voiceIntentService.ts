import { GoogleGenAI } from '@google/genai';
import type { VoiceIntent, VoiceTargetEntry, ActiveGoalContext } from '../types/voiceIntents.js';
import { isVoiceIntent } from '../types/voiceIntents.js';
import { UI_NODES, findNodeId, getNodeById } from '../voice/uiMapData.js';

const MODEL = 'gemini-2.5-flash';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

export type VoiceIntentRequest = {
  transcript: string;
  context: {
    pathname: string;
    search: string;
    isAuthenticated: boolean;
    isAdmin: boolean;
    visibleTargets: VoiceTargetEntry[];
    currentNodeId: string | null;
    activeGoal: ActiveGoalContext | null;
  };
  uiMapPrompt: string;
};

function nodeAllowed(nodeId: string | null, isAuthenticated: boolean, isAdmin: boolean): boolean {
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

function validateIntent(
  intent: VoiceIntent,
  ctx: VoiceIntentRequest['context']
): VoiceIntent {
  const { isAuthenticated, isAdmin, visibleTargets, currentNodeId } = ctx;
  const targetIds = new Set(visibleTargets.map((t) => t.id));

  if (intent.type === 'navigate') {
    const toId = resolveNavigateTarget(intent.path, intent.query);
    if (!toId || !nodeAllowed(toId, isAuthenticated, isAdmin)) {
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
    if (!nextId || !nodeAllowed(nextId, isAuthenticated, isAdmin)) {
      return { type: 'unsupported', reason: 'That tab or filter change is not allowed.' };
    }
    const ok = from.transitions.some((t) => t.to === nextId && t.via === 'set_query');
    if (!ok) {
      return { type: 'unsupported', reason: 'That tab change is not available on this screen.' };
    }
    return intent;
  }

  if (intent.type === 'action') {
    if (!targetIds.has(intent.target_id)) {
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

function buildSystemInstruction(body: VoiceIntentRequest): string {
  const targetsBlock =
    body.context.visibleTargets.length === 0
      ? '(none)'
      : body.context.visibleTargets.map((t) => `- id:${t.id} label:${t.label} action:${t.action}`).join('\n');

  const goalBlock = body.context.activeGoal
    ? `ACTIVE_GOAL:
  goalId: ${body.context.activeGoal.goalId}
  description: ${body.context.activeGoal.description}
  completion: ${JSON.stringify(body.context.activeGoal.completion)}
  stepsTaken: ${body.context.activeGoal.stepsTaken}
  maxSteps: ${body.context.activeGoal.maxSteps}
When the user's next action satisfies completion, emit goal_complete with that goalId and a short summary.`
    : 'ACTIVE_GOAL: none';

  return `You are a voice UI agent for a React web app. Output exactly ONE JSON object matching one of these shapes (no markdown, no prose outside JSON):
- {"type":"navigate","path":"/path","query":{},"reason":"..."}
- {"type":"set_query","query":{"tab":"library"},"reason":"..."}
- {"type":"action","target_id":"id","value":"optional text for fill","reason":"..."}
- {"type":"speak","text":"..."}
- {"type":"clarify","question":"...","options":["a","b"]}
- {"type":"goal_complete","goalId":"...","summary":"..."}
- {"type":"unsupported","reason":"..."}

Rules:
- path MUST be one of the paths listed in the UI map index.
- For navigate, include query only when the target node requires it (e.g. gallery library tab).
- target_id MUST be one of the visible target ids listed below (for action only).
- Prefer navigate over action when the user wants to open a page.
- Be concise in reason strings (spoken to user).

${body.uiMapPrompt}

### VISIBLE_TARGETS
${targetsBlock}

### ${goalBlock}

### OUTPUT
Return only valid JSON for one intent.`;
}

export async function parseVoiceIntent(body: VoiceIntentRequest): Promise<VoiceIntent> {
  const ai = getAI();
  const systemInstruction = buildSystemInstruction(body);
  const userText = `User said: ${body.transcript}\n\nCurrent URL path: ${body.context.pathname}\nSearch: ${body.context.search}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { type: 'unsupported', reason: 'Could not parse assistant response.' };
  }

  if (!isVoiceIntent(parsed)) {
    return { type: 'unsupported', reason: 'Invalid intent shape.' };
  }

  return validateIntent(parsed, body.context);
}

/** Fallback when Gemini is unavailable */
export function ruleBasedIntent(transcript: string, ctx: VoiceIntentRequest['context']): VoiceIntent {
  const t = transcript.toLowerCase().trim();
  if (!t) return { type: 'unsupported', reason: 'Empty transcript.' };

  for (const node of UI_NODES) {
    if (!nodeAllowed(node.id, ctx.isAuthenticated, ctx.isAdmin)) continue;
    for (const phrase of node.whenToUse) {
      if (t.includes(phrase.toLowerCase())) {
        const q = node.query ? `?${new URLSearchParams(node.query).toString()}` : '';
        const intent: VoiceIntent = {
          type: 'navigate',
          path: node.path,
          query: node.query,
          reason: `Opening ${node.title}.`,
        };
        return validateIntent(intent, ctx);
      }
    }
  }

  return { type: 'clarify', question: 'What would you like to open?', options: ['Dashboard', 'Build persona', 'Simulations', 'Settings'] };
}
