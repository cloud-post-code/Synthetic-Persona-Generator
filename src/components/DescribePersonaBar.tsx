import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MessageCircle, Mic, MicOff, SendHorizontal, Sparkles } from 'lucide-react';
import { geminiService } from '../services/gemini.js';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSecureContextForMic,
} from '../voice/speechRecognition.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';
import { buildPersonaAssistantSchema } from '../forms/index.js';
import { fieldTargetId } from '../forms/types.js';

export type BuildPersonaMode = 'synthetic_user' | 'advisor';

export type DescribePersonaBarProps = {
  onApplyDraft: (draft: PersonaBuildDraft) => void;
  disabled?: boolean;
  /** When set, the planner only returns that persona kind (user already opened that builder). */
  lockPersonaType?: BuildPersonaMode | null;
};

export const DescribePersonaBar: React.FC<DescribePersonaBarProps> = ({
  onApplyDraft,
  disabled = false,
  lockPersonaType = null,
}) => {
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLines, setChatLines] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const recRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const describeRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const sendChatRef = useRef<HTMLButtonElement>(null);
  const formKey = buildPersonaAssistantSchema.formKey;
  const voiceSupported = isSpeechRecognitionSupported() && isSecureContextForMic();

  useVoiceTarget({
    id: fieldTargetId(formKey, 'describe'),
    label: 'Describe your persona',
    action: 'fill',
    ref: describeRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled,
  });
  useVoiceTarget({
    id: fieldTargetId(formKey, 'mic_toggle'),
    label: 'Voice describe persona',
    action: 'click',
    ref: micRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && voiceSupported,
  });
  useVoiceTarget({
    id: fieldTargetId(formKey, 'generate'),
    label: 'Build persona form from description',
    action: 'click',
    ref: generateRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && !isGenerating,
  });
  useVoiceTarget({
    id: fieldTargetId(formKey, 'chat_input'),
    label: 'Refine persona description chat',
    action: 'fill',
    ref: chatInputRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && chatOpen,
  });
  useVoiceTarget({
    id: fieldTargetId(formKey, 'chat_send'),
    label: 'Send refine chat',
    action: 'click',
    ref: sendChatRef as React.RefObject<HTMLElement | null>,
    enabled: !disabled && chatOpen && !chatBusy,
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
      const draft = await geminiService.draftPersonaBuildFromDescription(trimmed, {
        forcePersonaType: lockPersonaType ?? undefined,
      });
      onApplyDraft(draft);
      const kind = draft.persona_type === 'advisor' ? 'Advisor' : 'Synthetic user';
      const sub =
        draft.persona_type === 'advisor'
          ? draft.advisor_source ?? 'source'
          : draft.synthetic_method ?? 'method';
      setSuccessSummary(
        `${kind} · ${sub}. ${draft.routing_rationale} Review the fields below, then submit when ready.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsGenerating(false);
    }
  }, [disabled, isGenerating, lockPersonaType, onApplyDraft, text]);

  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy || disabled) return;
    setChatBusy(true);
    setError(null);
    setChatInput('');
    try {
      const { assistant_reply, updated_notes } = await geminiService.refinePersonaBuildNotesViaChat(
        text,
        chatLines,
        msg
      );
      setText(updated_notes);
      setChatLines((h) => [...h, { role: 'user', text: msg }, { role: 'assistant', text: assistant_reply }]);
    } catch (e) {
      setChatInput(msg);
      setError(e instanceof Error ? e.message : 'Chat refine failed.');
    } finally {
      setChatBusy(false);
    }
  }, [chatBusy, chatInput, chatLines, disabled, text]);

  if (disabled) return null;

  return (
    <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm ring-1 ring-indigo-950/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Describe your persona</h3>
          <p className="mt-1 text-sm text-slate-600">
            Type or use the mic, then <span className="font-semibold text-indigo-700">Build it for me</span> to pick
            Synthetic user vs Advisor, choose the best method, and fill the form. Use{' '}
            <span className="font-semibold text-slate-800">Refine with chat</span> to tweak the notes before building.
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
            placeholder="Example: I need three B2B buyer personas for a new analytics product—we're solving reporting sprawl for mid-market ops teams. Or: Build an advisor from this expert: former McKinsey partner, specializes in pricing strategy, based in London…"
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

      <div className="mt-4 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-indigo-600" aria-hidden />
            Refine with chat
          </span>
          {chatOpen ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
        </button>
        {chatOpen ? (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
              {chatLines.length === 0 ? (
                <p className="text-slate-500">Ask for changes to the description above (e.g. &quot;Make it B2C&quot; or &quot;Add healthcare context&quot;).</p>
              ) : (
                chatLines.map((line, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 ${line.role === 'user' ? 'ml-4 bg-indigo-100 text-indigo-950' : 'mr-4 bg-white text-slate-800 ring-1 ring-slate-200'}`}
                  >
                    <span className="text-xs font-bold uppercase text-slate-500">{line.role === 'user' ? 'You' : 'Assistant'}</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{line.text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                rows={2}
                placeholder="Refinement request…"
                className="min-w-0 flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
              />
              <button
                ref={sendChatRef}
                type="button"
                disabled={chatBusy || !chatInput.trim()}
                onClick={() => void sendChat()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
