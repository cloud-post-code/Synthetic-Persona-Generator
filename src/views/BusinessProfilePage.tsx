import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { commandBus } from '../voice/commandBus.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  Printer,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import { DescribeBusinessProfileBar } from '../components/DescribeBusinessProfileBar.js';
import {
  geminiService,
  GEMINI_FILE_INPUT_ACCEPT,
  type BusinessProfileSectionSource,
  type BusinessProfileVoiceDraft,
} from '../services/gemini.js';
import { businessProfileFormSchema } from '../forms/index.js';
import { fieldTargetId } from '../forms/types.js';
import {
  BUSINESS_PROFILE_SPEC,
  type BusinessProfileSectionKey,
  businessProfileAnswerKey,
  getAllBusinessProfileAnswerKeys,
} from '../constants/businessProfileSpec.js';
import { compileBusinessProfileMarkdown } from '../utils/businessProfile.js';

type VoiceFieldRef = { id: string; label: string };

const BP_GEN_MAX_FILES = 12;

type BpGenFile = { id: string; name: string; data: string; mimeType?: string };

function bpFileReadsAsBinary(file: File): boolean {
  const t = file.type || '';
  if (t.startsWith('application/pdf') || t.startsWith('image/')) return true;
  return !['text/plain', 'text/csv', 'application/json'].includes(t);
}

async function readBpGenFile(file: File): Promise<BpGenFile> {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
    reader.onload = () => {
      const data = String(reader.result ?? '');
      if (!data.trim()) {
        reject(new Error(`“${file.name}” appears empty.`));
        return;
      }
      if (bpFileReadsAsBinary(file)) {
        resolve({
          id,
          name: file.name,
          data,
          mimeType: file.type || 'application/octet-stream',
        });
      } else {
        resolve({ id, name: file.name, data });
      }
    };
    if (bpFileReadsAsBinary(file)) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

function buildBpGenerationSource(files: BpGenFile[], companyHint: string): BusinessProfileSectionSource {
  const textParts: string[] = [];
  const inlineFiles: { data: string; mimeType: string; name?: string }[] = [];
  for (const f of files) {
    if (f.mimeType) {
      inlineFiles.push({ data: f.data, mimeType: f.mimeType, name: f.name });
    } else {
      textParts.push(`--- ${f.name} ---\n${f.data}`);
    }
  }
  return {
    companyHint: companyHint.trim() || undefined,
    textCorpus: textParts.length ? textParts.join('\n\n') : undefined,
    inlineFiles: inlineFiles.length ? inlineFiles : undefined,
  };
}

function emptyAnswers(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of getAllBusinessProfileAnswerKeys()) o[k] = '';
  return o;
}

/** Answer keys for the “Who is your customer” section only (Business Profile spec). */
const WHO_IS_CUSTOMER_ANSWER_KEYS = getAllBusinessProfileAnswerKeys().filter((k) =>
  k.startsWith('who_is_customer.'),
);

function answersForApi(a: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) {
    const t = (v ?? '').trim();
    if (t) out[k] = t;
  }
  return out;
}

const bp = (key: string): VoiceFieldRef => ({
  id: fieldTargetId(businessProfileFormSchema.formKey, key),
  label: businessProfileFormSchema.fields.find((f) => f.key === key)?.label ?? key,
});

const TextArea: React.FC<{
  qKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ qKey, label, value, onChange }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useVoiceTarget({
    id: fieldTargetId(businessProfileFormSchema.formKey, qKey),
    label,
    action: 'fill',
    ref: ref as React.RefObject<HTMLElement | null>,
    enabled: true,
  });
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
      />
    </div>
  );
};

const BusinessProfilePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, string>>(emptyAnswers);

  const activeTab = useMemo((): BusinessProfileSectionKey => {
    const t = searchParams.get('tab');
    if (t && BUSINESS_PROFILE_SPEC.some((s) => s.key === t)) return t as BusinessProfileSectionKey;
    return 'who_is_customer';
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: BusinessProfileSectionKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [collapsedFw, setCollapsedFw] = useState<Record<string, boolean>>({});
  const [viewFull, setViewFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateFiles, setGenerateFiles] = useState<BpGenFile[]>([]);
  const [companyHint, setCompanyHint] = useState('');
  const generateCancelledRef = useRef(false);

  useVoiceTarget({
    id: 'business.save',
    label: 'Save business profile (legacy alias)',
    action: 'click',
    ref: saveBtnRef as React.RefObject<HTMLElement | null>,
    enabled: !loading,
  });
  useVoiceTarget({
    id: fieldTargetId(businessProfileFormSchema.formKey, 'save'),
    label: 'Save business profile',
    action: 'click',
    ref: saveBtnRef as React.RefObject<HTMLElement | null>,
    enabled: !loading,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBusinessProfile()
      .then((profile) => {
        if (cancelled) return;
        const next = emptyAnswers();
        if (profile?.answers) {
          for (const [k, v] of Object.entries(profile.answers)) {
            if (k in next && typeof v === 'string') next[k] = v;
          }
        }
        setAnswers(next);
        loadedRef.current = true;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (payload: Record<string, string>) => {
    setSaveState('saving');
    setSaveMessage(null);
    try {
      await saveBusinessProfile({ answers: payload });
      commandBus.emit({ type: 'business_profile:saved' });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveState('error');
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current || loading) return;
    const id = window.setTimeout(() => {
      void persist(answersForApi(answers));
    }, 750);
    return () => window.clearTimeout(id);
  }, [answers, loading, persist]);

  const handleManualSave = () => {
    void persist(answersForApi(answers));
  };

  const hasCustomerProfileContent = useMemo(
    () => WHO_IS_CUSTOMER_ANSWER_KEYS.some((k) => (answers[k] ?? '').trim()),
    [answers],
  );

  const handleClearCustomerProfile = () => {
    if (!hasCustomerProfileContent || loading) return;
    if (
      !window.confirm(
        'Clear all saved answers under “Who is your customer” (persona, beachhead, segmentation)? Other profile sections stay as they are.',
      )
    ) {
      return;
    }
    const next: Record<string, string> = { ...answers };
    for (const k of WHO_IS_CUSTOMER_ANSWER_KEYS) next[k] = '';
    const payload = answersForApi(next);
    void (async () => {
      setSaveState('saving');
      setSaveMessage(null);
      try {
        await saveBusinessProfile({ answers: payload });
        commandBus.emit({ type: 'business_profile:saved' });
        setAnswers(next);
        setSaveState('saved');
        setSaveMessage('Customer profile cleared.');
        window.setTimeout(() => {
          setSaveState('idle');
          setSaveMessage(null);
        }, 3000);
      } catch (err) {
        setSaveState('error');
        setSaveMessage(err instanceof Error ? err.message : 'Clear failed');
        window.setTimeout(() => {
          setSaveState('idle');
          setSaveMessage(null);
        }, 4000);
      }
    })();
  };

  const setQuestion = (key: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  };

  const toggleFw = (fwId: string) => {
    setCollapsedFw((c) => ({ ...c, [fwId]: !c[fwId] }));
  };

  const mdExport = useMemo(() => compileBusinessProfileMarkdown(answers), [answers]);

  const downloadMarkdown = () => {
    const blob = new Blob([mdExport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business-profile.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    window.print();
  };

  const handleGenerateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    setGenerateError(null);
    const remaining = BP_GEN_MAX_FILES - generateFiles.length;
    if (remaining <= 0) {
      setGenerateError(`You can add at most ${BP_GEN_MAX_FILES} files. Remove some to add more.`);
      return;
    }
    const toAdd = Array.from(list).slice(0, remaining);
    try {
      const entries = await Promise.all(toAdd.map((f) => readBpGenFile(f)));
      setGenerateFiles((prev) => [...prev, ...entries]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  };

  const removeGenerateFile = (id: string) => {
    setGenerateFiles((prev) => prev.filter((f) => f.id !== id));
    setGenerateError(null);
  };

  const clearGenerateFiles = () => {
    setGenerateFiles([]);
    setGenerateError(null);
  };

  const mergeGenerated = (partial: Record<string, string | null>) => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(partial)) {
        if (v != null && String(v).trim()) next[k] = String(v).trim();
      }
      return next;
    });
  };

  const handleVoiceDraft = useCallback(async (draft: BusinessProfileVoiceDraft) => {
    const filled = draft.filled;
    const validSections = new Set(BUSINESS_PROFILE_SPEC.map((s) => s.key));

    const bySection: Partial<Record<BusinessProfileSectionKey, Record<string, string>>> = {};
    for (const [k, v] of Object.entries(filled)) {
      const sec = k.split('.')[0];
      if (!validSections.has(sec as BusinessProfileSectionKey)) continue;
      const sk = sec as BusinessProfileSectionKey;
      if (!bySection[sk]) bySection[sk] = {};
      bySection[sk]![k] = v;
    }

    const sectionsInOrder = BUSINESS_PROFILE_SPEC.map((s) => s.key).filter((k) => bySection[k]);

    const applyPartial = (partial: Record<string, string>) => {
      setAnswers((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(partial)) {
          const t = String(v).trim();
          if (t) next[k] = t;
        }
        return next;
      });
    };

    for (const sectionKey of sectionsInOrder) {
      const partial = bySection[sectionKey];
      if (!partial) continue;
      setActiveTab(sectionKey);

      const fwIds = new Set<string>();
      for (const key of Object.keys(partial)) {
        const parts = key.split('.');
        if (parts.length >= 3) fwIds.add(`${parts[0]}.${parts[1]}`);
      }
      if (fwIds.size > 0) {
        setCollapsedFw((c) => {
          const next = { ...c };
          for (const id of fwIds) next[id] = false;
          return next;
        });
      }
      applyPartial(partial);
      await new Promise<void>((r) => window.setTimeout(r, 450));
    }

    const labels = sectionsInOrder.map(
      (k) => BUSINESS_PROFILE_SPEC.find((s) => s.key === k)?.shortLabel ?? k,
    );
    const summary = [`Applied to ${labels.join(', ')}.`, draft.routing_rationale].filter(Boolean).join(' ');
    setSaveMessage(summary);
    window.setTimeout(() => setSaveMessage(null), 6000);
  }, [setActiveTab]);

  const handleGenerate = async () => {
    const source = buildBpGenerationSource(generateFiles, companyHint);
    if (!source.textCorpus && !source.inlineFiles?.length && !source.companyHint) {
      setGenerateError('Upload one or more documents and/or enter a company name or website to generate from.');
      return;
    }
    generateCancelledRef.current = false;
    setGenerateLoading(true);
    setGenerateError(null);
    setGenerateStage(null);
    try {
      for (const sec of BUSINESS_PROFILE_SPEC) {
        if (generateCancelledRef.current) return;
        setGenerateStage(`Filling: ${sec.title}…`);
        const part = await geminiService.generateBusinessProfileSection(sec.key, source);
        mergeGenerated(part);
      }
      if (!generateCancelledRef.current) {
        setSaveMessage('Generated. Review answers; auto-save will sync.');
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err) {
      if (!generateCancelledRef.current) {
        setGenerateError(err instanceof Error ? err.message : 'Generation failed.');
      }
    } finally {
      if (!generateCancelledRef.current) {
        setGenerateLoading(false);
        setGenerateStage(null);
      }
    }
  };

  const activeSection = BUSINESS_PROFILE_SPEC.find((s) => s.key === activeTab)!;

  return (
    <div className="min-h-screen bg-[#fafafa] print:bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 print:max-w-none print:px-6 print:py-6">
        <header className="mb-8 flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Business Profile</h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500">
              Structured frameworks across six categories. Answers auto-save. Used when building personas and running
              simulations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearCustomerProfile}
              disabled={loading || generateLoading || !hasCustomerProfileContent}
              title="Remove all answers in the Customer section only"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              Clear customer profile
            </button>
            <button
              type="button"
              onClick={() => setViewFull((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                viewFull ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              {viewFull ? 'Edit sections' : 'View full profile'}
            </button>
            <div className="relative inline-flex rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={downloadMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <FileDown className="h-4 w-4" />
                Markdown
              </button>
              <span className="w-px self-stretch bg-gray-200" />
              <button
                type="button"
                onClick={printPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                PDF
              </button>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                saveState === 'saving'
                  ? 'bg-amber-50 text-amber-800'
                  : saveState === 'saved'
                    ? 'bg-emerald-50 text-emerald-800'
                    : saveState === 'error'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-gray-100 text-gray-600'
              }`}
            >
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && 'Saved'}
              {saveState === 'error' && (saveMessage || 'Error')}
              {saveState === 'idle' && 'Auto-save on'}
            </span>
            <button
              ref={saveBtnRef}
              type="button"
              onClick={handleManualSave}
              className="sr-only"
              aria-hidden
            >
              Save
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : viewFull ? (
          <article className="prose prose-sm max-w-none rounded-xl border border-gray-200 bg-white p-8 prose-headings:font-semibold print:border-0 print:shadow-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{mdExport || '_No answers yet._'}</pre>
          </article>
        ) : (
          <>
            <DescribeBusinessProfileBar onApplyDraft={handleVoiceDraft} disabled={generateLoading} />

            <section className="mb-6 print:hidden space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Generate with AI
              </h3>
              <p className="text-xs text-indigo-900/80">
                Upload one or more documents (PDF, images, Word, text, CSV, JSON) and/or a company hint. We fill each
                section (six model calls) into your profile.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Documents (optional, multiple)
                  </label>
                  <div className="flex flex-col rounded-lg border border-dashed border-indigo-200 bg-white/80 px-3 py-3">
                    <div className="mb-3 flex flex-col items-center py-2">
                      <Upload className="mb-2 h-8 w-8 text-indigo-300" />
                      <input
                        type="file"
                        id="bp-gen-file"
                        className="hidden"
                        multiple
                        accept={GEMINI_FILE_INPUT_ACCEPT}
                        onChange={(ev) => void handleGenerateFileChange(ev)}
                      />
                      <label
                        htmlFor="bp-gen-file"
                        className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        {generateFiles.length ? 'Add more files' : 'Choose files'}
                      </label>
                      <p className="mt-2 text-center text-[11px] text-indigo-900/70">
                        Up to {BP_GEN_MAX_FILES} files · hold Cmd/Ctrl to select several
                      </p>
                    </div>
                    {generateFiles.length > 0 && (
                      <ul className="max-h-40 space-y-1.5 overflow-y-auto border-t border-indigo-100 pt-2 text-xs text-gray-800">
                        {generateFiles.map((f) => (
                          <li
                            key={f.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-white/90 px-2 py-1.5 ring-1 ring-gray-100"
                          >
                            <span className="min-w-0 truncate font-medium" title={f.name}>
                              {f.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeGenerateFile(f.id)}
                              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {generateFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={clearGenerateFiles}
                        className="mt-2 text-center text-[11px] font-semibold text-indigo-800 underline hover:text-indigo-950"
                      >
                        Clear all files
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Company name or website (optional)</label>
                  <input
                    type="text"
                    value={companyHint}
                    onChange={(e) => {
                      setCompanyHint(e.target.value);
                      setGenerateError(null);
                    }}
                    placeholder="e.g. Acme Inc"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
              </div>
              {generateError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {generateError}
                </div>
              )}
              {saveMessage && !generateError && (
                <div className="flex items-center gap-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  {saveMessage}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={generateLoading || (!generateFiles.length && !companyHint.trim())}
                  onClick={() => void handleGenerate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {generateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generateLoading ? generateStage || 'Generating…' : 'Generate from document'}
                </button>
                {generateLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      generateCancelledRef.current = true;
                      setGenerateLoading(false);
                      setGenerateStage(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                )}
              </div>
            </section>

            <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 print:hidden" aria-label="Sections">
              {BUSINESS_PROFILE_SPEC.map((sec) => (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => setActiveTab(sec.key)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                    activeTab === sec.key
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {sec.shortLabel}
                </button>
              ))}
            </nav>

            <div className="print:hidden space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{activeSection.title}</h2>
              {activeSection.frameworks.map((fw) => {
                const fwId = `${activeSection.key}.${fw.key}`;
                const collapsed = collapsedFw[fwId];
                return (
                  <section key={fwId} className="rounded-lg border border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleFw(fwId)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50/80"
                    >
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                      )}
                      <span>
                        <span className="block font-medium text-gray-900">{fw.title}</span>
                        <span className="block text-xs text-gray-500">{fw.description}</span>
                      </span>
                    </button>
                    {!collapsed && (
                      <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                        {fw.questions.map((q) => {
                          const qKey = businessProfileAnswerKey(activeSection.key, fw.key, q.key);
                          return (
                            <TextArea
                              key={qKey}
                              qKey={qKey}
                              label={q.label}
                              value={answers[qKey] ?? ''}
                              onChange={(v) => setQuestion(qKey, v)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}

        {/* Print-only full profile */}
        <div className="hidden print:block">
          <pre className="whitespace-pre-wrap font-sans text-sm">{mdExport}</pre>
        </div>
      </div>
    </div>
  );
};

export default BusinessProfilePage;
