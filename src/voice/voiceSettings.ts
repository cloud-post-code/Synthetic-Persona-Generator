const KEY_ENABLED = 'voice_agent_enabled';
const KEY_TTS = 'voice_agent_tts';

export function isVoiceAgentEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(KEY_ENABLED);
  if (v === null) return true;
  return v === '1' || v === 'true';
}

export function isVoiceTtsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(KEY_TTS);
  if (v === null) return true;
  return v !== '0' && v !== 'false';
}

export function setVoiceAgentEnabled(on: boolean) {
  localStorage.setItem(KEY_ENABLED, on ? '1' : '0');
  window.dispatchEvent(new CustomEvent('voice-settings-changed'));
}

export function setVoiceTtsEnabled(on: boolean) {
  localStorage.setItem(KEY_TTS, on ? '1' : '0');
  window.dispatchEvent(new CustomEvent('voice-settings-changed'));
}
