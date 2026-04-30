import { apiClient } from '../services/api.js';
import type { VoiceIntent, VoiceIntentRequestBody, VoiceIntentResult } from './intents.js';

export async function postVoiceIntent(body: VoiceIntentRequestBody): Promise<VoiceIntentResult> {
  return apiClient.post<VoiceIntentResult>('/voice/intent', body);
}

/** Unauthenticated (e.g. login); server forces anonymous context. */
export async function postVoiceIntentPublic(body: VoiceIntentRequestBody): Promise<VoiceIntentResult> {
  return apiClient.post<VoiceIntentResult>('/voice/intent-public', body);
}

export function postVoiceIntentForUser(
  body: VoiceIntentRequestBody,
  isAuthenticated: boolean
): Promise<VoiceIntentResult> {
  return isAuthenticated ? postVoiceIntent(body) : postVoiceIntentPublic(body);
}

export type VoicePlanResponse =
  | { kind: 'plan'; planId: string; steps: VoiceIntent[]; maxSteps: number; maxReplans: number; maxWallclockMs: number }
  | { kind: 'inline'; plan: null; result: VoiceIntent }
  | { kind: 'fallback'; plan: null; result: VoiceIntent };

export async function postVoicePlan(body: VoiceIntentRequestBody): Promise<VoicePlanResponse> {
  return apiClient.post<VoicePlanResponse>('/voice/plan', body);
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
  | { action: 'replan'; steps: VoiceIntent[]; cursor: number; reason?: string }
  | { action: 'done' }
  | { action: 'cancelled'; reason?: string }
  | { action: 'failed'; reason?: string };

export async function postVoiceObserve(body: VoiceObservationBody): Promise<VoiceObservationResponse> {
  return apiClient.post<VoiceObservationResponse>('/voice/observe', body);
}

export async function postVoiceCancel(planId: string): Promise<{ ok: boolean; status: string }> {
  return apiClient.post<{ ok: boolean; status: string }>('/voice/cancel', { planId });
}
