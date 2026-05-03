import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Pause, Play, XCircle } from 'lucide-react';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSecureContextForMic,
} from '../voice/speechRecognition.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';
import { fieldTargetId } from '../forms/types.js';

export type DescribeBarBuildResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

export type DescribeBarProps = {
  formKey: string;
  micVoiceLabel: string;
  title: string;
  description: React.ReactNode;
  emptyHint?: string;
  buildingHint?: string;
  emptyError: string;
  onBuild: (description: string) => Promise<DescribeBarBuildResult>;
  disabled?: boolean;
  /** Mic button title when idle (voice supported). */
  micIdleTitle?: string;
  /** Mic button title while recording. */
  micRecordingTitle?: string;
  /** Mic button title while building. */
  micBuildingTitle?: string;
};

export const DescribeBar: React.FC<DescribeBarProps> = ({
  formKey,
  micVoiceLabel,
  title,
  description,
  emptyHint = 'Speak to see your words here…',
  buildingHint = 'Building from what you said…',
  emptyError,
  onBuild,
  disabled = false,
  micIdleTitle = 'Tap to speak; tap again to build',
  micRecordingTitle = 'Stop and build from what you said',
  micBuildingTitle = 'Building…',
}) => {
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  type MicPhase = 'idle' | 'listening' | 'paused';
  const [micPhase, setMicPhase] = useState<MicPhase>('idle');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);
  const recRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef('');
  const interimRef = useRef('');
  const voiceSupported = isSpeechRecognitionSupported() && isSecureContextForMic();

  textRef.current = text;
  interimRef.current = interim;

  useVoiceTarget({
    id: fieldTargetId(formKey, 'mic_toggle'),
    label: micVoiceLabel,
    action: 'click',
    ref: micRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && voiceSupported && !isGenerating,
  });

  const attachRecognition = useCallback(() => {
    const rec = createSpeechRecognition({
      onResult: (t, isFinal) => {
        if (!isFinal) {
          interimRef.current = t;
          setInterim(t);
          return;
        }
        interimRef.current = '';
        setInterim('');
        setText((prev) => {
          const next = prev ? `${prev.trimEnd()}\n\n${t.trim()}` : t.trim();
          textRef.current = next;
          return next;
        });
      },
      onError: (msg) => {
        setError(msg);
        recRef.current?.abort?.();
        recRef.current = null;
        setMicPhase('idle');
        setInterim('');
      },
      onEnd: () => {
        const i = interimRef.current.trim();
        if (i) {
          setText((prev) => {
            const next = prev ? `${prev.trimEnd()}\n\n${i}` : i;
            textRef.current = next;
            return next;
          });
        }
        interimRef.current = '';
        setInterim('');
        recRef.current = null;
        setMicPhase((prev) => (prev === 'listening' ? 'paused' : prev));
      },
    });
    recRef.current = rec;
    rec.start();
  }, []);

  useEffect(() => {
    return () => {
      recRef.current?.abort?.();
      recRef.current = null;
    };
  }, []);

  const handleGenerate = useCallback(
    async (descriptionOverride?: string) => {
      if (disabled || isGenerating) return;
      const source = descriptionOverride ?? text;
      const trimmed = source.trim();
      if (!trimmed) {
        setError(emptyError);
        return;
      }
      setError(null);
      setSuccessSummary(null);
      setIsGenerating(true);
      try {
        const result = await onBuild(trimmed);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccessSummary(result.summary);
        setText('');
        setInterim('');
        textRef.current = '';
        interimRef.current = '';
        setMicPhase('idle');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setIsGenerating(false);
      }
    },
    [disabled, emptyError, isGenerating, onBuild, text],
  );

  const pauseListening = useCallback(() => {
    if (micPhase !== 'listening' || isGenerating) return;
    const merged = [textRef.current.trim(), interimRef.current.trim()].filter(Boolean).join('\n\n').trim();
    setText(merged);
    textRef.current = merged;
    setInterim('');
    interimRef.current = '';
    setMicPhase('paused');
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
  }, [micPhase, isGenerating]);

  const cancelListening = useCallback(() => {
    if ((micPhase !== 'listening' && micPhase !== 'paused') || isGenerating) return;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setMicPhase('idle');
    setText('');
    setInterim('');
    textRef.current = '';
    interimRef.current = '';
    setError(null);
    setSuccessSummary(null);
  }, [micPhase, isGenerating]);

  const stopAndBuildFromPaused = useCallback(() => {
    if (disabled || isGenerating || micPhase !== 'paused') return;
    const merged = [textRef.current.trim(), interimRef.current.trim()].filter(Boolean).join('\n\n').trim();
    void handleGenerate(merged);
  }, [disabled, isGenerating, micPhase, handleGenerate]);

  const toggleMic = useCallback(() => {
    if (disabled || !voiceSupported || isGenerating) return;
    if (micPhase === 'listening') {
      const merged = [textRef.current.trim(), interimRef.current.trim()].filter(Boolean).join('\n\n').trim();
      setMicPhase('idle');
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      setText(merged);
      textRef.current = merged;
      setInterim('');
      interimRef.current = '';
      void handleGenerate(merged);
      return;
    }
    if (micPhase === 'paused') {
      setError(null);
      setMicPhase('listening');
      try {
        attachRecognition();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not resume voice input.');
        setMicPhase('paused');
      }
      return;
    }
    setError(null);
    setSuccessSummary(null);
    setText('');
    setInterim('');
    textRef.current = '';
    interimRef.current = '';
    setMicPhase('listening');
    try {
      attachRecognition();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start voice input.');
      setMicPhase('idle');
    }
  }, [attachRecognition, disabled, handleGenerate, isGenerating, micPhase, voiceSupported]);

  if (disabled) return null;

  const micTitle = !voiceSupported
    ? 'Voice not available in this browser'
    : isGenerating
      ? micBuildingTitle
      : micPhase === 'listening'
        ? micRecordingTitle
        : micPhase === 'paused'
          ? 'Resume dictation'
          : micIdleTitle;

  return (
    <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm ring-1 ring-indigo-950/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <div className="mt-1 text-sm text-slate-600">{description}</div>
        </div>
      </div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {successSummary && (
        <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {successSummary}
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 flex-col gap-2 sm:max-w-[220px]">
          <button
            ref={micRef}
            type="button"
            onClick={toggleMic}
            disabled={!voiceSupported || isGenerating}
            title={micTitle}
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
              isGenerating
                ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-600'
                : micPhase === 'listening'
                  ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Building…
              </>
            ) : micPhase === 'listening' ? (
              <>
                <MicOff className="h-5 w-5" aria-hidden />
                Stop &amp; build
              </>
            ) : micPhase === 'paused' ? (
              <>
                <Play className="h-5 w-5" aria-hidden />
                Resume
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" aria-hidden />
                Mic
              </>
            )}
          </button>
          {micPhase === 'listening' ? (
            <button
              type="button"
              onClick={pauseListening}
              disabled={!voiceSupported || isGenerating}
              title="Pause dictation (no build yet)"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pause className="h-5 w-5" aria-hidden />
              Pause
            </button>
          ) : null}
          {micPhase === 'paused' ? (
            <button
              type="button"
              onClick={stopAndBuildFromPaused}
              disabled={!voiceSupported || isGenerating}
              title={micRecordingTitle}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MicOff className="h-5 w-5" aria-hidden />
              Stop &amp; build
            </button>
          ) : null}
          {micPhase === 'listening' || micPhase === 'paused' ? (
            <button
              type="button"
              onClick={cancelListening}
              disabled={!voiceSupported || isGenerating}
              title="Discard and stop (no build)"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <XCircle className="h-5 w-5" aria-hidden />
              Cancel
            </button>
          ) : null}
        </div>
        <div
          className="min-h-[120px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner"
          aria-live="polite"
          aria-label="Live transcription"
        >
          {isGenerating ? (
            <p className="text-slate-500">{buildingHint}</p>
          ) : text || interim ? (
            <p className="whitespace-pre-wrap">
              {text}
              {interim ? <span className="text-slate-500"> {interim}</span> : null}
            </p>
          ) : (
            <p className="text-slate-400">{emptyHint}</p>
          )}
        </div>
      </div>
    </div>
  );
};
