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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      holdingRef.current = true;
      startRec();
    },
    [startRec]
  );

  const onPointerUp = useCallback(() => {
    holdingRef.current = false;
    recRef.current?.stop();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        taskTracker.cancel();
        cancelSpeech();
        stopRec();
        return;
      }
      if (e.code === 'Space' && !holdingRef.current) {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
        e.preventDefault();
        holdingRef.current = true;
        startRec();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        holdingRef.current = false;
        recRef.current?.stop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRec, stopRec]);

  if (!isDockVisible) return null;

  const supported = isSpeechRecognitionSupported() && isSecureContextForMic();
  const busy = agentState === 'thinking' || agentState === 'acting' || agentState === 'speaking';

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
        <span className="hidden sm:inline pl-2 text-xs text-gray-500 max-w-[140px]">
          {busy ? 'Working…' : 'Hold mic or Space'}
        </span>
        <button
          type="button"
          disabled={!supported || busy}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            agentState === 'listening'
              ? 'bg-red-500 text-white ring-2 ring-red-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40'
          }`}
          title={supported ? 'Hold to speak' : 'Voice not available'}
          aria-label="Voice control, hold to speak"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : supported ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
};
