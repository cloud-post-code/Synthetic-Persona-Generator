import { GoogleGenAI } from '@google/genai';
import type { VoiceIntent, VoiceIntentResult, VoiceTargetEntry, ActiveGoalContext } from '../types/voiceIntents.js';
import { isVoiceIntent, isVoiceIntentBatch } from '../types/voiceIntents.js';
import { UI_NODES, findNodeId, getNodeById } from '../voice/uiMapData.js';

const MODEL = 'gemini-2.5-flash';
/** Enough for navigate + several fills + Save/Continue on wizards */
const MAX_BATCH_STEPS = 12;

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

type ValidateOpts = { skipActionTargetCheck?: boolean };

function validateIntent(
  intent: VoiceIntent,
  ctx: VoiceIntentRequest['context'],
  opts?: ValidateOpts
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

function validateBatchSteps(
  rawSteps: unknown[],
  ctx: VoiceIntentRequest['context']
): VoiceIntentResult {
  if (rawSteps.length === 0) {
    return { type: 'unsupported', reason: 'Empty batch.' };
  }
  if (rawSteps.length > MAX_BATCH_STEPS) {
    return { type: 'unsupported', reason: `At most ${MAX_BATCH_STEPS} steps per utterance.` };
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

  return `You are a voice UI agent for a React web app. You **plan end-to-end user journeys**, not isolated clicks. Output exactly ONE JSON value (no markdown, no prose outside JSON):

Single intent (one action):
- {"type":"navigate","path":"/path","query":{},"reason":"..."}
- {"type":"set_query","query":{"tab":"library"},"reason":"..."}
- {"type":"action","target_id":"id","value":"optional text for fill","reason":"..."}
- {"type":"speak","text":"..."}
- {"type":"clarify","question":"...","options":["a","b"]}
- {"type":"goal_complete","goalId":"...","summary":"..."}
- {"type":"unsupported","reason":"..."}

OR a **batch** when completing the user's goal requires **multiple ordered steps** (strongly prefer this for flows that span navigation + typing + confirmation):
- {"type":"batch","steps":[ intent1, intent2, ... ]}
- Or a JSON array of intents in order: [ intent1, intent2, ... ]
- Max ${MAX_BATCH_STEPS} steps per utterance. If the ideal flow is longer, include the **most important** contiguous steps (usually: get to the right screen → fill → Save/Continue/Submit). Order: navigate/tab first, then fills, then primary buttons (Save, Continue, Next, Run simulation, Sign in, Submit).

### END-TO-END FLOW MINDSET
- Infer the **whole task** the user wants **done** (e.g. "set up a persona", "log in", "run my simulation", "save business profile"). Map the **likely sequence**: open the right page/section → fill visible fields the user mentioned → press **Continue / Next / Save / Submit / Run / Sign in** when those controls appear in VISIBLE_TARGETS (match by label text).
- **Confirmation steps matter**: wizards and forms often need **Next** or **Continue** between steps before **Save**. Include **action** steps for those buttons when their target_id / label appears in VISIBLE_TARGETS.
- **Same screen**: you can batch multiple **action** steps (several fills, then click Save) in one response when all targets are listed below.
- **After navigation in a batch**, later **action** target_ids may appear only on the next screen—the client rescans; you may still emit those steps in order.

### WHEN TO ASK (clarify)—required
- If you **lack essential information** (which persona, which simulation, ambiguous destination, or any value the user did not say and you should not guess), output **clarify** with one short **question** and optional **options** (2–5). Invite them to answer by voice next time.
- **Never invent** passwords, secrets, or private credentials; if missing, **clarify** or **speak** that they should say the value or type it.
- If the request is vague ("do the thing", "fix it") and you cannot map to the UI, **clarify** instead of random navigation.

### TYPICAL FLOWS (reasonable assumptions—use batch when multiple steps apply)
- **Login**: on /login—fill email/username and password fields if user gave them; **action** on Sign in / Log in button by target id.
- **Build / create persona**: go to /build if needed—fill fields user specified—**Save** or **Continue** / **Next** per visible labels.
- **Business profile / settings**: navigate there—edit fields—**Save** if shown.
- **Simulations**: /simulations or /simulate—configure what is visible—**Run** / **Start** / **Continue** as labeled.
- **Gallery**: **set_query** for tabs (saved, library, focusGroups) or navigate—open item if user named it and control exists.

Rules:
- path MUST be one of the paths listed in the UI map index.
- For navigate, include query only when the target node requires it (e.g. gallery library tab).
- target_id for action MUST match a visible target id on the **current** screen in context, except **after** a navigate or set_query inside the same batch (next-screen targets allowed there).
- Prefer **navigate** over guessing sidebar links when opening a major area.
- Use a **single** intent only when the ask is truly one atomic step; otherwise prefer a **batch** that completes the likely flow.
- Be concise in **reason** strings (often spoken aloud).

${body.uiMapPrompt}

### VISIBLE_TARGETS
${targetsBlock}

### ${goalBlock}

### OUTPUT
Return only valid JSON: one intent object, or {"type":"batch","steps":[...]}, or a JSON array of intents.`;
}

export async function parseVoiceIntent(body: VoiceIntentRequest): Promise<VoiceIntentResult> {
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

  if (Array.isArray(parsed)) {
    return validateBatchSteps(parsed, body.context);
  }
  if (isVoiceIntentBatch(parsed)) {
    return validateBatchSteps(parsed.steps, body.context);
  }
  if (!isVoiceIntent(parsed)) {
    return { type: 'unsupported', reason: 'Invalid intent shape.' };
  }

  return validateIntent(parsed, body.context);
}

/** Fallback when Gemini is unavailable */
export function ruleBasedIntent(transcript: string, ctx: VoiceIntentRequest['context']): VoiceIntentResult {
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
