/**
 * Global mic dock (bottom-right, Hold ⌘). Not mounted — see src/App.tsx (VoiceAgentProvider + VoiceAgentDock commented out).
 * To restore: uncomment those lines in App.tsx.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { createSpeechRecognition, isSpeechRecognitionSupported, isSecureContextForMic } from './speechRecognition.js';
import { cancelSpeech } from './tts.js';
import { taskTracker } from './taskTracker.js';
import { useVoiceAgent } from './VoiceAgentProvider.js';
import { commandBus } from './commandBus.js';

type PlanStatusBanner =
  | { kind: 'idle' }
  | { kind: 'planning' }
  | { kind: 'step'; current: number; total: number; description: string }
  | { kind: 'replan'; cursor: number; total: number; reason?: string }
  | { kind: 'done'; at: number }
  | { kind: 'cancelled'; reason?: string }
  | { kind: 'failed'; reason?: string };

export const VoiceAgentDock: React.FC = () => {
  const { agentState, startListening, stopListening, pushTranscript, isDockVisible, lastError } = useVoiceAgent();
  const [interim, setInterim] = useState('');
  const [planBanner, setPlanBanner] = useState<PlanStatusBanner>({ kind: 'idle' });
  const recRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const holdingRef = useRef(false);

  const supported = isSpeechRecognitionSupported() && isSecureContextForMic();
  const busy = agentState === 'thinking' || agentState === 'acting' || agentState === 'speaking';

  useEffect(() => {
    let clearTimer: number | null = null;
    const off = commandBus.on((evt) => {
      if (clearTimer) {
        window.clearTimeout(clearTimer);
        clearTimer = null;
      }
      switch (evt.type) {
        case 'voice:plan:start':
          setPlanBanner({ kind: 'step', current: 1, total: evt.totalSteps, description: 'Planning…' });
          break;
        case 'voice:plan:step':
          setPlanBanner({
            kind: 'step',
            current: evt.stepIndex + 1,
            total: evt.totalSteps,
            description: evt.description,
          });
          break;
        case 'voice:plan:replan':
          setPlanBanner({ kind: 'replan', cursor: evt.cursor + 1, total: evt.totalSteps, reason: evt.reason });
          break;
        case 'voice:plan:done':
          setPlanBanner({ kind: 'done', at: Date.now() });
          clearTimer = window.setTimeout(() => setPlanBanner({ kind: 'idle' }), 2500);
          break;
        case 'voice:plan:cancelled':
          setPlanBanner({ kind: 'cancelled', reason: evt.reason });
          clearTimer = window.setTimeout(() => setPlanBanner({ kind: 'idle' }), 2500);
          break;
        case 'voice:plan:failed':
          setPlanBanner({ kind: 'failed', reason: evt.reason });
          clearTimer = window.setTimeout(() => setPlanBanner({ kind: 'idle' }), 4000);
          break;
        default:
          break;
      }
    });
    return () => {
      off();
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, []);

  useEffect(() => {
    if (agentState === 'thinking' && planBanner.kind === 'idle') {
      setPlanBanner({ kind: 'planning' });
    }
  }, [agentState, planBanner.kind]);

  const renderBanner = () => {
    if (planBanner.kind === 'idle') return null;
    if (planBanner.kind === 'planning') return <p className="text-indigo-700">Planning…</p>;
    if (planBanner.kind === 'step') {
      return (
        <p className="text-indigo-700">
          Step {planBanner.current}/{planBanner.total}: {planBanner.description}
        </p>
      );
    }
    if (planBanner.kind === 'replan') {
      return (
        <p className="text-amber-700">
          Replanning from step {planBanner.cursor}/{planBanner.total}
          {planBanner.reason ? `: ${planBanner.reason}` : ''}
        </p>
      );
    }
    if (planBanner.kind === 'done') return <p className="text-green-700">Task complete.</p>;
    if (planBanner.kind === 'cancelled') return <p className="text-gray-600">Plan cancelled{planBanner.reason ? ` — ${planBanner.reason}` : ''}.</p>;
    if (planBanner.kind === 'failed') return <p className="text-red-600">Plan failed{planBanner.reason ? ` — ${planBanner.reason}` : ''}.</p>;
    return null;
  };

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
      {(interim || lastError || planBanner.kind !== 'idle') && (
        <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-lg backdrop-blur">
          {lastError && <p className="text-red-600">{lastError}</p>}
          {renderBanner()}
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
