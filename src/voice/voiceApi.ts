import { apiClient } from '../services/api.js';
import { tokenUsageStore } from '../services/tokenUsageStore.js';
import { normalizeUsageMetadata } from '../utils/geminiUsage.js';
import type { VoiceIntent, VoiceIntentRequestBody, VoiceIntentResult } from './intents.js';

function recordVoiceAgentUsage(usage: unknown): void {
  const u = normalizeUsageMetadata(usage);
  if (u) tokenUsageStore.addUsage('voice_agent', u);
}

type VoiceIntentEnvelope = { intent: VoiceIntentResult; usage?: unknown };

function unwrapVoiceIntentResponse(raw: VoiceIntentEnvelope | VoiceIntentResult): VoiceIntentResult {
  if (raw && typeof raw === 'object' && 'intent' in raw) {
    const e = raw as VoiceIntentEnvelope;
    recordVoiceAgentUsage(e.usage);
    return e.intent;
  }
  return raw as VoiceIntentResult;
}

export async function postVoiceIntent(body: VoiceIntentRequestBody): Promise<VoiceIntentResult> {
  const raw = await apiClient.post<VoiceIntentEnvelope | VoiceIntentResult>('/voice/intent', body);
  return unwrapVoiceIntentResponse(raw);
}

/** Unauthenticated (e.g. login); server forces anonymous context. */
export async function postVoiceIntentPublic(body: VoiceIntentRequestBody): Promise<VoiceIntentResult> {
  const raw = await apiClient.post<VoiceIntentEnvelope | VoiceIntentResult>('/voice/intent-public', body);
  return unwrapVoiceIntentResponse(raw);
}

export function postVoiceIntentForUser(
  body: VoiceIntentRequestBody,
  isAuthenticated: boolean
): Promise<VoiceIntentResult> {
  return isAuthenticated ? postVoiceIntent(body) : postVoiceIntentPublic(body);
}

export type VoicePlanResponse =
  | {
      kind: 'plan';
      planId: string;
      steps: VoiceIntent[];
      maxSteps: number;
      maxReplans: number;
      maxWallclockMs: number;
      usage?: unknown;
    }
  | { kind: 'inline'; plan: null; result: VoiceIntent; usage?: unknown }
  | { kind: 'fallback'; plan: null; result: VoiceIntent; usage?: unknown };

export async function postVoicePlan(body: VoiceIntentRequestBody): Promise<VoicePlanResponse> {
  const data = await apiClient.post<VoicePlanResponse>('/voice/plan', body);
  recordVoiceAgentUsage((data as { usage?: unknown }).usage);
  return data;
}

export type VoiceObservationBody = {
  planId: string;
  observation: {
    stepIndex: number;
    pathname?: string;
    currentNodeId?: string | null;
    visibleTargetIds?: string[];
    summary?: string;
    validationError?: string | null;
    matched?: boolean;
    ok?: boolean;
  };
  latestContext?: VoiceIntentRequestBody['context'];
};

export type VoiceObservationResponse =
  | { action: 'continue'; cursor: number }
  | { action: 'replan'; steps: VoiceIntent[]; cursor: number; reason?: string; usage?: unknown }
  | { action: 'done' }
  | { action: 'cancelled'; reason?: string }
  | { action: 'failed'; reason?: string };

export async function postVoiceObserve(body: VoiceObservationBody): Promise<VoiceObservationResponse> {
  const data = await apiClient.post<VoiceObservationResponse>('/voice/observe', body);
  if (data.action === 'replan') {
    recordVoiceAgentUsage((data as { usage?: unknown }).usage);
  }
  return data;
}

export async function postVoiceCancel(planId: string): Promise<{ ok: boolean; status: string }> {
  return apiClient.post<{ ok: boolean; status: string }>('/voice/cancel', { planId });
}
