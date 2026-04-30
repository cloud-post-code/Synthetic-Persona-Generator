import { apiClient } from '../services/api.js';
import type { VoiceIntentRequestBody, VoiceIntentResult } from './intents.js';

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
