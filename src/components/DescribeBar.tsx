import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
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
  const [isRecording, setIsRecording] = useState(false);
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

  const stopRec = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setIsRecording(false);
    setInterim('');
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setIsGenerating(false);
      }
    },
    [disabled, emptyError, isGenerating, onBuild, text],
  );

  const toggleMic = useCallback(() => {
    if (disabled || !voiceSupported || isGenerating) return;
    if (isRecording) {
      const merged = [textRef.current.trim(), interimRef.current.trim()].filter(Boolean).join('\n\n').trim();
      stopRec();
      setText(merged);
      textRef.current = merged;
      interimRef.current = '';
      void handleGenerate(merged);
      return;
    }
    setError(null);
    setSuccessSummary(null);
    setText('');
    setInterim('');
    textRef.current = '';
    interimRef.current = '';
    setIsRecording(true);
    try {
      const rec = createSpeechRecognition({
        onResult: (t, isFinal) => {
          if (!isFinal) {
            setInterim(t);
            return;
          }
          setInterim('');
          setText((prev) => {
            const next = prev ? `${prev.trimEnd()}\n\n${t.trim()}` : t.trim();
            textRef.current = next;
            return next;
          });
        },
        onError: (msg) => {
          setError(msg);
          stopRec();
        },
        onEnd: () => {
          setIsRecording(false);
          setInterim('');
        },
      });
      recRef.current = rec;
      rec.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start voice input.');
      setIsRecording(false);
    }
  }, [disabled, voiceSupported, isGenerating, isRecording, stopRec, handleGenerate]);

  if (disabled) return null;

  const micTitle = !voiceSupported
    ? 'Voice not available in this browser'
    : isGenerating
      ? micBuildingTitle
      : isRecording
        ? micRecordingTitle
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
        <div className="flex shrink-0 flex-col sm:max-w-[220px]">
          <button
            ref={micRef}
            type="button"
            onClick={toggleMic}
            disabled={!voiceSupported || isGenerating}
            title={micTitle}
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
              isGenerating
                ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-600'
                : isRecording
                  ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Building…
              </>
            ) : isRecording ? (
              <>
                <MicOff className="h-5 w-5" aria-hidden />
                Stop &amp; build
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" aria-hidden />
                Mic
              </>
            )}
          </button>
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
