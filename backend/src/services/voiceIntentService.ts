import { GoogleGenAI } from '@google/genai';
import type { VoiceIntent, VoiceIntentResult } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import { isVoiceIntent, isVoiceIntentBatch } from '../types/voiceIntents.js';
import { UI_NODES } from '../voice/uiMapData.js';
import { classifyIntent } from './intentClassifier.js';
import { expandTemplate } from './templateExpander.js';
import { topKIntentsByKeyword } from '../voice/intentTemplates.js';
import type { DigestViewer } from './userDataContext.js';
import { validateIntent, validateBatchSteps, voiceNodeAllowed } from '../voice/voiceIntentValidation.js';
import { VOICE_AGENT_MODEL } from '../voice/voiceModel.js';
import { buildVoiceSystemInstruction } from '../voice/voiceSystemPrompt.js';
import {
  buildPlannerUserHints,
  enrichVoiceUiMapPrompt,
  buildSemanticsRetrievalQuery,
  defaultDigestDomainsForVoice,
} from '../voice/voicePromptEnrichment.js';
import { transcriptSuggestsMultiStep } from '../voice/voiceTranscriptHints.js';

export { hintedDomainsFromTranscript, transcriptSuggestsMultiStep } from '../voice/voiceTranscriptHints.js';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

export type { VoiceIntentRequest };

export async function parseVoiceIntent(body: VoiceIntentRequest): Promise<VoiceIntentResult> {
  const ai = getAI();
  const systemInstruction = buildVoiceSystemInstruction(body, {});
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

/** Fallback when Gemini is unavailable */
export function ruleBasedIntent(transcript: string, ctx: VoiceIntentRequest['context']): VoiceIntentResult {
  const t = transcript.toLowerCase().trim();
  if (!t) return { type: 'unsupported', reason: 'Empty transcript.' };

  for (const node of UI_NODES) {
    if (!voiceNodeAllowed(node.id, ctx.isAuthenticated, ctx.isAdmin)) continue;
    for (const phrase of node.whenToUse) {
      if (t.includes(phrase.toLowerCase())) {
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
    const isNavigateOnly = stepsOnly.length === 1 && stepsOnly[0]!.type === 'navigate';
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

  const digestDomains = defaultDigestDomainsForVoice(body);
  const enriched = await enrichVoiceUiMapPrompt({
    body,
    auth,
    viewer,
    digestDomains,
    semanticsQuery: buildSemanticsRetrievalQuery(body.transcript, body.context.currentNodeId),
  });

  const planned = await parseVoiceIntent(enriched);

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
