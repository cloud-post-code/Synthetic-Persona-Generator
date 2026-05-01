/**
 * Multi-step planner used by the navigator agent. Extracted from
 * `voiceIntentService` so the new `/api/voice/plan` and `/api/voice/observe`
 * routes can call into the same prompt pipeline that backs `/api/voice/intent`.
 *
 * Pipeline per planning call:
 *  1. Build the system prompt from `uiMapPrompt + buildDigestBlock + buildSemanticsBlock`.
 *  2. Send transcript + observation hints to Gemini (`gemini-2.5-flash`).
 *  3. Parse JSON, run through `validateBatchSteps` (re-exported from voiceIntentService).
 *
 * Hard caps live here (`MAX_BATCH_STEPS=24`, wallclock + step caps in PlanRecord).
 */

import { GoogleGenAI } from '@google/genai';
import { isVoiceIntent, isVoiceIntentBatch, type VoiceIntent, type VoiceIntentResult } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import { findNodeId, getNodeById } from '../voice/uiMapData.js';
import {
  retrieveUiSemantics,
  UI_SEMANTIC_SOURCE_TYPES,
} from './embeddingService.js';
import type { UiSemanticType } from '../voice/uiSemantics.js';
import type { Domain } from './userDataContext.js';
import { getDigest, mergeVoiceDigestDomains, type DigestViewer } from './userDataContext.js';
import { hintedDomainsFromTranscript, transcriptSuggestsMultiStep } from './voiceIntentService.js';

const MODEL = 'gemini-2.5-flash';
/** Hard cap on plan size returned in one shot. */
export const MAX_BATCH_STEPS = 24;
/** Max replan iterations for a single user utterance. */
export const MAX_REPLANS = 8;
/** Max wallclock per plan (ms). */
export const MAX_PLAN_WALLCLOCK_MS = 60_000;
/** Default top-k for the semantics retriever. */
const SEMANTICS_TOPK = 8;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

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

export function validateBatchSteps(
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

async function buildDigestBlock(
  userId: string,
  domains: Domain[],
  viewer?: DigestViewer
): Promise<string> {
  if (domains.length === 0) return '';
  const lines: string[] = ['', '### USER_DATA (live, scoped to you)'];
  for (const d of domains) {
    const hits = await getDigest(userId, d, 20, viewer);
    lines.push(`${String(d).toUpperCase()}:`);
    if (hits.length === 0) lines.push('  (none)');
    else {
      for (const h of hits) {
        const meta = h.meta ? ` | meta:${JSON.stringify(h.meta)}` : '';
        lines.push(`  - id:${h.id} | name:${JSON.stringify(h.name)}${meta}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * Pull the most relevant chunks from the embedded UI semantics corpus and
 * format them into a prompt block. Best-effort: returns '' on any failure
 * so the planner still works without RAG.
 */
export async function buildSemanticsBlock(
  query: string,
  topK: number = SEMANTICS_TOPK,
  types?: UiSemanticType[]
): Promise<string> {
  if (!query.trim()) return '';
  try {
    const chunks = await retrieveUiSemantics(query, topK, types ?? UI_SEMANTIC_SOURCE_TYPES);
    if (chunks.length === 0) return '';
    const lines: string[] = ['', '### UI_SEMANTICS (retrieved RAG context)'];
    for (const c of chunks) {
      const score = typeof c.score === 'number' ? c.score.toFixed(3) : '?';
      lines.push(`-- ${c.source_type} | ${c.source_name} | score=${score}`);
      lines.push(c.text);
    }
    return lines.join('\n');
  } catch (err) {
    console.warn('[voice.semantics] retrieval failed', err);
    return '';
  }
}

export type PlannerCallContext = {
  /** Optional observation context to feed back to the planner during a replan. */
  replan?: {
    reason: string;
    lastSteps: VoiceIntent[];
    lastStepIndex?: number;
    /** Recent observations (most recent last). */
    recentObservations?: string[];
  };
  /** Override of hinted domains. If omitted, `hintedDomainsFromTranscript` is used. */
  domains?: Domain[];
};

function buildSystemInstruction(body: VoiceIntentRequest, replanBlock: string): string {
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

  return `You are a multi-step voice navigator for a React web app. You **plan end-to-end user journeys**, not isolated clicks. Output exactly ONE JSON value (no markdown, no prose outside JSON):

### DEFAULT OUTPUT SHAPE (read first)
- **Prefer** a JSON **array** of intents in order, OR \`{"type":"batch","steps":[...]}\`, whenever the user wants something **done** (not only "go to X").
- **Single-object** output is only for truly **one** atomic step (e.g. only **speak** / **clarify** / **goal_complete** / **unsupported**).
- Max ${MAX_BATCH_STEPS} steps. Order: **navigate** or **set_query** first if the user is not already on the right screen, then **action** fills, then primary **action** clicks (Save, Continue, Next, Run, Sign in, Submit).

Preferred multi-step forms:
- \`{"type":"batch","steps":[ intent1, intent2, ... ]}\`
- Or the same as a raw JSON array: \`[ intent1, intent2, ... ]\`

Intent object shapes:
- {"type":"navigate","path":"/path","query":{},"reason":"..."}
- {"type":"set_query","query":{"tab":"library"},"reason":"..."}
- {"type":"action","target_id":"id","value":"optional text for fill","reason":"..."}
- {"type":"speak","text":"..."}
- {"type":"clarify","question":"...","options":["a","b"]}
- {"type":"goal_complete","goalId":"...","summary":"..."}
- {"type":"unsupported","reason":"..."}

### END-TO-END FLOW MINDSET
- Infer the **whole task** the user wants **done**. Map the **likely sequence**: open the right page/section -> fill fields -> press primary buttons (Continue / Save / Submit / Run / Sign in).
- If **CURRENT_NODE** is not the screen where the work happens, **start** with **navigate** or **set_query**, then add the **action** steps that complete the job. Later steps can target controls that are not yet visible — the client rescans after each step.
- **Same screen**: batch multiple **action** steps (several fills, then click Save) in one response when all targets are listed below.

### STABLE TARGET IDS
Form field target_ids follow \`pageDomain.formKey.fieldKey\`, e.g. \`business.profile.who_is_customer.target_customer_persona.primary_customer\`, \`build.persona.problem_solution.problem\`, \`simulations.template.title\`. Look these up in the UI_SEMANTICS block for the current screen and form.

### WHEN TO ASK (clarify)
- If you lack essential info (which persona, which simulation, ambiguous destination, password), output **clarify** with one short **question** and 2–5 **options**.
- Never invent passwords or private credentials.

Rules:
- path MUST be one of the paths listed in the UI map index.
- target_id for action MUST match a visible target id on the **current** screen, except **after** a navigate or set_query inside the same batch.
- When in doubt between one step and several, **choose several**.

${body.uiMapPrompt}

### VISIBLE_TARGETS
${targetsBlock}

### ${goalBlock}
${replanBlock}

### OUTPUT
Return only valid JSON: one intent object, or {"type":"batch","steps":[...]}, or a JSON array of intents.`;
}

function buildPlannerUserHints(body: VoiceIntentRequest): string {
  const n = body.context.visibleTargets.length;
  const lines: string[] = [];
  if (body.context.currentNodeId) {
    lines.push(`CURRENT_NODE_ID: ${body.context.currentNodeId}`);
  }
  if (n >= 2) {
    lines.push(
      `VISIBLE_TARGET_COUNT: ${n} — if the user wants to act on this screen (fill, save, run, etc.), include those action steps in the same batch or array after any navigate/set_query.`
    );
  }
  if (transcriptSuggestsMultiStep(body.transcript)) {
    lines.push(
      'MULTI_STEP_UTTERANCE: true — respond with a JSON array or {"type":"batch","steps":[...]} covering the full sequence.'
    );
  }
  return lines.length ? `\n${lines.join('\n')}` : '';
}

function buildReplanBlock(call?: PlannerCallContext): string {
  const r = call?.replan;
  if (!r) return '';
  const lines: string[] = ['', '### REPLAN'];
  lines.push(`Reason: ${r.reason}`);
  if (typeof r.lastStepIndex === 'number') {
    lines.push(`Failed step index: ${r.lastStepIndex} of ${r.lastSteps.length - 1}`);
  }
  if (r.lastSteps.length > 0) {
    lines.push('Previous plan (do not blindly retry the failing step):');
    r.lastSteps.forEach((s, i) => {
      lines.push(`  ${i}: ${JSON.stringify(s)}`);
    });
  }
  if (r.recentObservations && r.recentObservations.length > 0) {
    lines.push('Recent observations (oldest first):');
    for (const o of r.recentObservations) {
      lines.push(`  - ${o}`);
    }
  }
  lines.push('Adjust: pick a different target or path, or clarify if you cannot make progress.');
  return lines.join('\n');
}

/**
 * Single planner call. Builds prompt + RAG block, calls Gemini, validates the
 * result. Used by both the legacy `/api/voice/intent` path (via
 * `resolveVoiceIntent`) and the new `/api/voice/plan` and `/api/voice/observe`
 * routes.
 */
export async function planVoiceTurn(
  body: VoiceIntentRequest,
  auth: { userId: string | null },
  viewer?: DigestViewer,
  call?: PlannerCallContext
): Promise<VoiceIntentResult> {
  const ai = getAI();

  const hinted = call?.domains ?? hintedDomainsFromTranscript(body.transcript);
  const domains = mergeVoiceDigestDomains(body.context.pathname, hinted);
  const digestBlock =
    auth.userId && domains.length > 0 ? await buildDigestBlock(auth.userId, domains, viewer) : '';
  const semanticsQuery = call?.replan
    ? `${body.transcript}\n\nReplan reason: ${call.replan.reason}`
    : body.transcript;
  const semanticsBlock = await buildSemanticsBlock(semanticsQuery);
  const replanBlock = buildReplanBlock(call);

  const enrichedBody: VoiceIntentRequest = {
    ...body,
    uiMapPrompt: `${body.uiMapPrompt}${digestBlock}${semanticsBlock}`,
  };
  const systemInstruction = buildSystemInstruction(enrichedBody, replanBlock);
  const userText = `User said: ${body.transcript}\n\nCurrent URL path: ${body.context.pathname}\nSearch: ${body.context.search}${buildPlannerUserHints(body)}`;

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
