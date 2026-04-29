import { apiClient } from '../services/api.js';
import type { VoiceIntent, VoiceIntentRequestBody } from './intents.js';

export async function postVoiceIntent(body: VoiceIntentRequestBody): Promise<VoiceIntent> {
  return apiClient.post<VoiceIntent>('/voice/intent', body);
}
