import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles } from 'lucide-react';
import { geminiService } from '../services/gemini.js';
import { sanitizeDraft } from '../services/simulationDraft.js';
import type { SimulationTemplateFormHandle } from './SimulationTemplateForm.js';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSecureContextForMic,
} from '../voice/speechRecognition.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';
import { simulationTemplateFormSchema } from '../forms/index.js';
import { fieldTargetId } from '../forms/types.js';

export type DescribeSimulationBarProps = {
  formRef: React.RefObject<SimulationTemplateFormHandle | null>;
  disabled?: boolean;
};

function countFilledFields(d: ReturnType<typeof sanitizeDraft>): number {
  const tscKeys = d.type_specific_config ? Object.keys(d.type_specific_config).length : 0;
  const runner = d.required_input_fields?.length ?? 0;
  const personaTypes = d.allowed_persona_types?.length ?? 0;
  return 1 + 1 + 1 + personaTypes + 2 + tscKeys + runner + 1;
}

export const DescribeSimulationBar: React.FC<DescribeSimulationBarProps> = ({ formRef, disabled = false }) => {
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);
  const recRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const describeRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const tplKey = simulationTemplateFormSchema.formKey;
  const voiceSupported = isSpeechRecognitionSupported() && isSecureContextForMic();

  useVoiceTarget({
    id: fieldTargetId(tplKey, 'describe'),
    label: 'Describe your simulation',
    action: 'fill',
    ref: describeRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled,
  });
  useVoiceTarget({
    id: fieldTargetId(tplKey, 'mic_toggle'),
    label: 'Voice describe simulation',
    action: 'click',
    ref: micRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && voiceSupported,
  });
  useVoiceTarget({
    id: fieldTargetId(tplKey, 'generate'),
    label: 'Build simulation from description',
    action: 'click',
    ref: generateRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && !isGenerating,
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

  const toggleMic = useCallback(() => {
    if (disabled || !voiceSupported || isGenerating) return;
    if (isRecording) {
      stopRec();
      return;
    }
    setError(null);
    setSuccessSummary(null);
    setIsRecording(true);
    setInterim('');
    try {
      const rec = createSpeechRecognition({
        onResult: (t, isFinal) => {
          if (!isFinal) {
            setInterim(t);
            return;
          }
          setInterim('');
          setText((prev) => (prev ? `${prev.trimEnd()}\n\n${t.trim()}` : t.trim()));
          stopRec();
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
  }, [disabled, voiceSupported, isGenerating, isRecording, stopRec]);

  const handleGenerate = useCallback(async () => {
    if (disabled || isGenerating) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Add a description (type or dictate) first.');
      return;
    }
    setError(null);
    setSuccessSummary(null);
    setIsGenerating(true);
    try {
      const draft = await geminiService.draftSimulationFromDescription(trimmed);
      const d = sanitizeDraft(draft);
      const n = countFilledFields(d);
      await formRef.current?.applyDraft(d, { advanceToReview: false });
      setSuccessSummary(
        `Filled ${n} fields. Review the form below, then click Create Simulation when you are ready.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsGenerating(false);
    }
  }, [disabled, formRef, isGenerating, text]);

  if (disabled) return null;

  return (
    <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm ring-1 ring-indigo-950/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Describe your simulation</h3>
          <p className="mt-1 text-sm text-slate-600">
            Type or use the mic, then <span className="font-semibold text-indigo-700">Build it for me</span> to fill
            every field on the form. It does not save or open review—you choose{' '}
            <span className="font-semibold text-slate-800">Create Simulation</span> when ready.
          </p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1">
          <textarea
            ref={describeRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Example: A persuasion simulation where a founder pitches a B2B SaaS product to a skeptical CFO persona. Track how persuaded they are by the end. Runners provide the pitch deck summary and pricing context."
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {interim ? <p className="mt-1 text-xs text-slate-500">Listening: {interim}</p> : null}
        </div>
        <div className="flex shrink-0 flex-row gap-2 sm:w-auto sm:flex-col">
          <button
            ref={micRef}
            type="button"
            onClick={toggleMic}
            disabled={!voiceSupported || isGenerating}
            title={voiceSupported ? (isRecording ? 'Stop recording' : 'Speak to add text') : 'Voice not available in this browser'}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-initial ${
              isRecording
                ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            {isRecording ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            {isRecording ? 'Stop' : 'Mic'}
          </button>
          <button
            ref={generateRef}
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 sm:flex-initial"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Building…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" aria-hidden />
                Build it for me
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
