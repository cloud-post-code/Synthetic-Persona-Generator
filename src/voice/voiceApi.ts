import { apiClient } from '../services/api.js';
import type { VoiceIntent, VoiceIntentRequestBody } from './intents.js';

export async function postVoiceIntent(body: VoiceIntentRequestBody): Promise<VoiceIntent> {
  return apiClient.post<VoiceIntent>('/voice/intent', body);
}

/** Unauthenticated (e.g. login); server forces anonymous context. */
export async function postVoiceIntentPublic(body: VoiceIntentRequestBody): Promise<VoiceIntent> {
  return apiClient.post<VoiceIntent>('/voice/intent-public', body);
}

export function postVoiceIntentForUser(
  body: VoiceIntentRequestBody,
  isAuthenticated: boolean
): Promise<VoiceIntent> {
  return isAuthenticated ? postVoiceIntent(body) : postVoiceIntentPublic(body);
}
