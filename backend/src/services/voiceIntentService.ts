import { GoogleGenAI } from '@google/genai';
import type { VoiceIntent, VoiceIntentResult } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import { isVoiceIntent, isVoiceIntentBatch } from '../types/voiceIntents.js';
import { UI_NODES, findNodeId, getNodeById } from '../voice/uiMapData.js';
import { classifyIntent } from './intentClassifier.js';
import { expandTemplate } from './templateExpander.js';
import { topKIntentsByKeyword } from '../voice/intentTemplates.js';
import type { Domain } from './userDataContext.js';
import { getDigest, mergeVoiceDigestDomains, type DigestViewer } from './userDataContext.js';

const MODEL = 'gemini-2.5-flash';
/** Enough for navigate + several fills + Save/Continue on wizards */
const MAX_BATCH_STEPS = 12;

/** Utterance clearly asks for more than navigation alone — skip navigate-only named templates so the planner can batch. */
export function transcriptSuggestsMultiStep(transcript: string): boolean {
  const s = transcript.toLowerCase();
  return (
    /\b(and\s+then|then\s+(open|go|navigate|save|fill|click|run|start|submit|press))/.test(s) ||
    /\b(and\s+(open|go|save|fill|run|start|submit|click|press))/.test(s) ||
    /\b(save\s+it|fill\s+(it|in|out)|submit\s+it|run\s+it|run\s+the|start\s+the)\b/.test(s) ||
    /\b(then\s+save|then\s+fill|then\s+run|then\s+open|then\s+go)\b/.test(s) ||
    /\b(after\s+that|next\s+step|continue\s+(to|with))\b/.test(s) ||
    /\b(all\s+the\s+way|end\s+to\s+end|complete\s+(the|my)|finish\s+(it|the))\b/.test(s)
  );
}

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

export type { VoiceIntentRequest };

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

### DEFAULT OUTPUT SHAPE (read first)
- **Prefer** a JSON **array** of intents in order, OR \`{"type":"batch","steps":[...]}\`, whenever the user wants something **done** (not only "go to X").
- **Single-object** output is only for truly **one** atomic step (e.g. only "open settings" with no follow-up, or only **speak** / **clarify** / **goal_complete** / **unsupported**).
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
- Infer the **whole task** the user wants **done** (e.g. "set up a persona", "log in", "run my simulation", "save business profile"). Map the **likely sequence**: open the right page/section → fill visible fields the user mentioned → press **Continue / Next / Save / Submit / Run / Sign in** when those controls appear in VISIBLE_TARGETS (match by label text).
- If **CURRENT_NODE** is not the screen where the work happens, **start** with **navigate** or **set_query**, then add the **action** steps that complete the job—even when later targets are not in VISIBLE_TARGETS yet (the app will rescan after each step).
- **Confirmation steps matter**: wizards and forms often need **Next** or **Continue** between steps before **Save**. Include **action** steps for those buttons when their target_id / label appears in VISIBLE_TARGETS.
- **Same screen**: batch multiple **action** steps (several fills, then click Save) in one response when all targets are listed below.
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
- When in doubt between one step and several, **choose several** in one array/batch (the client runs them in order).
- Be concise in **reason** strings (often spoken aloud).

${body.uiMapPrompt}

### VISIBLE_TARGETS
${targetsBlock}

### ${goalBlock}

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
      'MULTI_STEP_UTTERANCE: true — the user implied a sequence; respond with a JSON array or {"type":"batch","steps":[...]} covering the full sequence (navigation first if needed, then actions).'
    );
  }
  return lines.length ? `\n${lines.join('\n')}` : '';
}

export async function parseVoiceIntent(body: VoiceIntentRequest): Promise<VoiceIntentResult> {
  const ai = getAI();
  const systemInstruction = buildSystemInstruction(body);
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

export function hintedDomainsFromTranscript(transcript: string): Domain[] {
  const t = transcript.toLowerCase();
  const out = new Set<Domain>();
  if (/\b(persona|character|synthetic)\b/.test(t)) out.add('persona');
  if (/\bfocus\s*group\b|\bcohort\b/.test(t)) out.add('focusGroup');
  if (/\b(member|participant|in\s+the\s+focus\s*group|who(?:'s|\s+is)\s+in)\b/.test(t)) {
    out.add('focusGroupMember');
  }
  if (/\bsimulation\b|\btemplate\b|\brun\s+(the\s+)?sim/.test(t)) out.add('simulationTemplate');
  if (/\b(simulation\s+(run|session)|past\s+sim|previous\s+sim|recent\s+sim|my\s+sim)\b/.test(t)) {
    out.add('simulationSession');
  }
  if (/\b(file|document|upload|pdf|attachment|blueprint)\b/.test(t)) out.add('personaFile');
  if (/\bbusiness\b|\bcompany\b/.test(t)) out.add('businessProfile');
  if (/\bchat\b|\bconversation\b|\bmessage\b/.test(t)) out.add('chat');
  if (/\bsettings\b|\bpreferences\b|\baccount\b/.test(t)) out.add('settings');
  if (/\bprofile\b|\bwho am i\b/.test(t)) out.add('profile');
  return [...out];
}

async function buildDigestBlock(userId: string, domains: Domain[], viewer?: DigestViewer): Promise<string> {
  if (domains.length === 0) return '';
  const lines: string[] = ['', '### USER_DATA (live, scoped to you)'];
  for (const d of domains) {
    const hits = await getDigest(userId, d, 20, viewer);
    console.info('[voice.userdata]', { userId, domain: d, hits: hits.length });
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

export async function resolveVoiceIntent(
  body: VoiceIntentRequest,
  auth: { userId: string | null },
  viewer?: DigestViewer
): Promise<VoiceIntentResult> {
  const cls = await classifyIntent(body, auth);
  if (cls.kind === 'matched') {
    if (cls.missing.length > 0) {
      const slot = cls.template.slots.find((s) => s.name === cls.missing[0]);
      if (slot) {
        return { type: 'clarify', question: slot.promptIfMissing };
      }
    }
    const stepsOnly = cls.template.steps;
    const isNavigateOnly =
      stepsOnly.length === 1 && stepsOnly[0]!.type === 'navigate';
    if (isNavigateOnly && transcriptSuggestsMultiStep(body.transcript)) {
      console.info('[voice.resolve] skipping navigate-only template for multi-step utterance', {
        template: cls.template.name,
      });
    } else {
      const expanded = await expandTemplate(cls.template, cls.slots, body.context, auth.userId);
      if (expanded.kind === 'clarify') return expanded.intent;
      if (expanded.kind === 'unsupported') return { type: 'unsupported', reason: expanded.reason };
      console.info('[voice.classifier]', { matched: cls.template.name });
      return validateBatchSteps(expanded.steps as unknown[], body.context);
    }
  }

  const hinted = mergeVoiceDigestDomains(body.context.pathname, hintedDomainsFromTranscript(body.transcript));
  let digestBlock = '';
  if (auth.userId && hinted.length > 0) {
    digestBlock = await buildDigestBlock(auth.userId, hinted, viewer);
  }

  const planned = await parseVoiceIntent({
    ...body,
    uiMapPrompt: body.uiMapPrompt + digestBlock,
  });

  if (planned.type === 'unsupported') {
    const closest = topKIntentsByKeyword(body.transcript, 3);
    if (closest.length === 0) return planned;
    return {
      type: 'clarify',
      question: 'I am not sure what to do. Did you mean one of these?',
      options: closest.map((t) => t.description),
    };
  }
  return planned;
}
