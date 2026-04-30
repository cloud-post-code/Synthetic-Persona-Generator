/** Web Speech API wrapper — requires secure context (HTTPS or localhost). Safari often has no SpeechRecognition; mic UI may be disabled. */

export type RecognitionCallbacks = {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
};

function getRecognitionCtor(): typeof window extends { SpeechRecognition: infer R } ? R : never {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    throw new Error('Speech recognition is not supported in this browser. Try Chrome or Edge.');
  }
  return Ctor as never;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSecureContextForMic(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext === true;
}

export function createSpeechRecognition(callbacks: RecognitionCallbacks): {
  start: () => void;
  stop: () => void;
  abort: () => void;
} {
  const Ctor = getRecognitionCtor() as new () => SpeechRecognition;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const t = r[0]?.transcript || '';
      if (r.isFinal) final += t;
      else interim += t;
    }
    const text = (final || interim).trim();
    if (text) callbacks.onResult(text, !!final);
  };

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    const msg =
      event.error === 'not-allowed'
        ? 'Microphone permission denied.'
        : event.error === 'no-speech'
          ? 'No speech detected.'
          : event.message || event.error;
    callbacks.onError(msg);
  };

  rec.onend = () => {
    callbacks.onEnd?.();
  };

  return {
    start() {
      if (!isSecureContextForMic()) {
        callbacks.onError('Voice requires HTTPS or localhost.');
        return;
      }
      try {
        rec.start();
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : 'Could not start recognition.');
      }
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort() {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
