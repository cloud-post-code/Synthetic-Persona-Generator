import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { createSpeechRecognition, isSpeechRecognitionSupported, isSecureContextForMic } from './speechRecognition.js';
import { cancelSpeech } from './tts.js';
import { taskTracker } from './taskTracker.js';
import { useVoiceAgent } from './VoiceAgentProvider.js';

export const VoiceAgentDock: React.FC = () => {
  const { agentState, startListening, stopListening, pushTranscript, isDockVisible, lastError } = useVoiceAgent();
  const [interim, setInterim] = useState('');
  const recRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const holdingRef = useRef(false);

  const supported = isSpeechRecognitionSupported() && isSecureContextForMic();
  const busy = agentState === 'thinking' || agentState === 'acting' || agentState === 'speaking';

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    stopListening();
    setInterim('');
  }, [stopListening]);

  const startRec = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return;
    if (!isSecureContextForMic()) return;
    startListening();
    setInterim('');
    const rec = createSpeechRecognition({
      onResult: (text, isFinal) => {
        if (isFinal) {
          setInterim('');
          pushTranscript(text, true);
          stopRec();
        } else {
          setInterim(text);
        }
      },
      onError: () => {
        stopRec();
      },
      onEnd: () => {
        if (holdingRef.current) return;
        stopRec();
      },
    });
    recRef.current = rec;
    rec.start();
  }, [pushTranscript, startListening, stopRec]);

  useEffect(() => {
    const isCommandKey = (e: KeyboardEvent) =>
      e.key === 'Meta' || e.code === 'MetaLeft' || e.code === 'MetaRight';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        taskTracker.cancel();
        cancelSpeech();
        stopRec();
        return;
      }
      if (!isCommandKey(e)) {
        // If another key is pressed while holding ⌘ (e.g. ⌘C, ⌘V), abort PTT
        if (holdingRef.current && e.metaKey) {
          holdingRef.current = false;
          recRef.current?.stop();
        }
        return;
      }
      if (e.repeat || holdingRef.current) return;
      if (!supported || busy) return;
      holdingRef.current = true;
      startRec();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isCommandKey(e)) return;
      if (!holdingRef.current) return;
      holdingRef.current = false;
      recRef.current?.stop();
    };

    const onBlur = () => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      recRef.current?.stop();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [stopRec, startRec, supported, busy]);

  if (!isDockVisible) return null;

  return (
    <div
      data-voice-exclude
      className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2 max-w-sm"
    >
      {(interim || lastError) && (
        <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-lg backdrop-blur">
          {lastError && <p className="text-red-600">{lastError}</p>}
          {interim && <p className="text-gray-800">{interim}</p>}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-2 py-2 shadow-lg">
        <span className="hidden sm:inline pl-2 text-xs text-gray-500 max-w-[160px]">
          {busy ? 'Working…' : 'Hold ⌘ · say undo'}
        </span>
        <div
          aria-disabled={!supported || busy}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            agentState === 'listening'
              ? 'bg-red-500 text-white ring-2 ring-red-300'
              : !supported || busy
                ? 'bg-indigo-600 text-white opacity-40'
                : 'bg-indigo-600 text-white'
          }`}
          title={supported ? 'Hold ⌘ (Command) to speak' : 'Voice not available'}
          aria-label="Voice control, hold the Command key to speak"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : supported ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </div>
      </div>
    </div>
  );
};
