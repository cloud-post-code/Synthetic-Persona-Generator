/**
 * Multi-step planner for `/api/voice/plan` and `/api/voice/observe` replans.
 * Shares validation, system prompt, and prompt enrichment with `voiceIntentService`.
 */

import { GoogleGenAI } from '@google/genai';
import { isVoiceIntent, isVoiceIntentBatch, type VoiceIntent, type VoiceIntentResult } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import type { Domain } from './userDataContext.js';
import { mergeVoiceDigestDomains, type DigestViewer } from './userDataContext.js';
import { MAX_VOICE_BATCH_STEPS, validateIntent, validateBatchSteps } from '../voice/voiceIntentValidation.js';
import { VOICE_AGENT_MODEL } from '../voice/voiceModel.js';
import { buildVoiceSystemInstruction } from '../voice/voiceSystemPrompt.js';
import {
  buildPlannerUserHints,
  enrichVoiceUiMapPrompt,
  buildSemanticsRetrievalQuery,
} from '../voice/voicePromptEnrichment.js';
import { hintedDomainsFromTranscript } from '../voice/voiceTranscriptHints.js';

/** Re-export for API responses (`maxSteps` in plan payload). */
export const MAX_BATCH_STEPS = MAX_VOICE_BATCH_STEPS;

/** Max replan iterations for a single user utterance. */
export const MAX_REPLANS = 8;
/** Max wallclock per plan (ms). */
export const MAX_PLAN_WALLCLOCK_MS = 60_000;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

export type PlannerCallContext = {
  replan?: {
    reason: string;
    lastSteps: VoiceIntent[];
    lastStepIndex?: number;
    recentObservations?: string[];
  };
  domains?: Domain[];
};

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
 * Single planner call: enrich prompt, call Gemini, validate.
 * Used by `/api/voice/plan`, `/api/voice/observe` replans, and aligned with `/api/voice/intent` via shared modules.
 */
export async function planVoiceTurn(
  body: VoiceIntentRequest,
  auth: { userId: string | null },
  viewer?: DigestViewer,
  call?: PlannerCallContext
): Promise<VoiceIntentResult> {
  const ai = getAI();

  const hinted = call?.domains ?? hintedDomainsFromTranscript(body.transcript);
  const digestDomains = mergeVoiceDigestDomains(
    body.context.pathname,
    body.context.currentNodeId ?? null,
    hinted
  );
  const semanticsQuery = buildSemanticsRetrievalQuery(
    body.transcript,
    body.context.currentNodeId,
    call?.replan?.reason
  );

  const enrichedBody = await enrichVoiceUiMapPrompt({
    body,
    auth,
    viewer,
    digestDomains,
    semanticsQuery,
  });

  const replanBlock = buildReplanBlock(call);
  const systemInstruction = buildVoiceSystemInstruction(enrichedBody, { replanBlock });
  const userText = `User said: ${body.transcript}\n\nCurrent URL path: ${body.context.pathname}\nSearch: ${body.context.search}${buildPlannerUserHints(body)}`;

  const response = await ai.models.generateContent({
    model: VOICE_AGENT_MODEL,
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
