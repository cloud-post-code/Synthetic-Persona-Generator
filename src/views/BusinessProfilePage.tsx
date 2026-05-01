import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { commandBus } from '../voice/commandBus.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';
import {
  AlertTriangle,
  BookOpen,
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
import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { KnowledgeDocumentUploadPreview } from '../components/KnowledgeDocumentUploadPreview.js';

type VoiceFieldRef = { id: string; label: string };

const BP_GEN_MAX_FILES = 12;

const TAB_KNOWLEDGE_BASE = 'knowledge_base' as const;
type BusinessProfilePageTab = BusinessProfileSectionKey | typeof TAB_KNOWLEDGE_BASE;

function bpFileReadsAsBinary(file: File): boolean {
  const t = file.type || '';
  if (t.startsWith('application/pdf') || t.startsWith('image/')) return true;
  return !['text/plain', 'text/csv', 'application/json'].includes(t);
}

async function readBpGenFile(file: File): Promise<BusinessProfileKnowledgeDocument> {
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

function buildBpGenerationSource(
  files: BusinessProfileKnowledgeDocument[],
  companyHint: string
): BusinessProfileSectionSource {
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

  const activeTab = useMemo((): BusinessProfilePageTab => {
    const t = searchParams.get('tab');
    if (t === TAB_KNOWLEDGE_BASE) return TAB_KNOWLEDGE_BASE;
    if (t && BUSINESS_PROFILE_SPEC.some((s) => s.key === t)) return t as BusinessProfileSectionKey;
    return 'who_is_customer';
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: BusinessProfilePageTab) => {
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
  const companyHintInputRef = useRef<HTMLInputElement>(null);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<BusinessProfileKnowledgeDocument[]>([]);
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
  useVoiceTarget({
    id: fieldTargetId(businessProfileFormSchema.formKey, 'company_hint'),
    label: 'Company name or website (optional)',
    action: 'fill',
    ref: companyHintInputRef as React.RefObject<HTMLElement | null>,
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
        setKnowledgeFiles(
          Array.isArray(profile?.knowledge_documents)
            ? profile.knowledge_documents.filter(
                (d) =>
                  d &&
                  typeof d.id === 'string' &&
                  typeof d.name === 'string' &&
                  typeof d.data === 'string' &&
                  d.id.trim() &&
                  d.name.trim() &&
                  d.data,
              )
            : [],
        );
        const hint = profile?.company_hint;
        setCompanyHint(typeof hint === 'string' ? hint : '');
        loadedRef.current = true;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (payload: Record<string, string>, docs: BusinessProfileKnowledgeDocument[], hint: string) => {
      setSaveState('saving');
      setSaveMessage(null);
      try {
        const t = hint.trim();
        await saveBusinessProfile({
          answers: payload,
          knowledge_documents: docs,
          company_hint: t ? t : null,
        });
        commandBus.emit({ type: 'business_profile:saved' });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        setSaveState('error');
        setSaveMessage(err instanceof Error ? err.message : 'Save failed');
        setTimeout(() => setSaveState('idle'), 4000);
      }
    },
    [],
  );

  useEffect(() => {
    if (!loadedRef.current || loading) return;
    const id = window.setTimeout(() => {
      void persist(answersForApi(answers), knowledgeFiles, companyHint);
    }, 750);
    return () => window.clearTimeout(id);
  }, [answers, knowledgeFiles, companyHint, loading, persist]);

  useEffect(() => {
    if (activeTab === TAB_KNOWLEDGE_BASE && knowledgeFiles.length === 0) {
      setActiveTab('who_is_customer');
    }
  }, [activeTab, knowledgeFiles.length, setActiveTab]);

  const handleManualSave = () => {
    void persist(answersForApi(answers), knowledgeFiles, companyHint);
  };

  const hasBusinessProfileContent = useMemo(() => {
    const hasAnswers = getAllBusinessProfileAnswerKeys().some((k) => (answers[k] ?? '').trim());
    return hasAnswers || knowledgeFiles.length > 0 || companyHint.trim().length > 0;
  }, [answers, knowledgeFiles, companyHint]);

  const handleClearBusinessProfile = () => {
    if (!hasBusinessProfileContent || loading) return;
    if (
      !window.confirm(
        'Clear the entire business profile? This removes all section answers, uploaded knowledge documents, and the company or website hint used for generation. This cannot be undone.',
      )
    ) {
      return;
    }
    const next = emptyAnswers();
    void (async () => {
      setSaveState('saving');
      setSaveMessage(null);
      try {
        await saveBusinessProfile({ answers: {}, knowledge_documents: [], company_hint: null });
        commandBus.emit({ type: 'business_profile:saved' });
        setAnswers(next);
        setKnowledgeFiles([]);
        setCompanyHint('');
        setGenerateError(null);
        setSaveState('saved');
        setSaveMessage('Business profile cleared.');
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
    const remaining = BP_GEN_MAX_FILES - knowledgeFiles.length;
    if (remaining <= 0) {
      setGenerateError(`You can add at most ${BP_GEN_MAX_FILES} files. Remove some to add more.`);
      return;
    }
    const toAdd = Array.from(list as FileList) as File[];
    try {
      const entries = await Promise.all(toAdd.map((f) => readBpGenFile(f)));
      setKnowledgeFiles((prev) => [...prev, ...entries]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  };

  const removeKnowledgeFile = (id: string) => {
    setKnowledgeFiles((prev) => prev.filter((f) => f.id !== id));
    setGenerateError(null);
  };

  const clearKnowledgeFiles = () => {
    setKnowledgeFiles([]);
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
    const source = buildBpGenerationSource(knowledgeFiles, companyHint);
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

  const activeSection =
    activeTab === TAB_KNOWLEDGE_BASE ? undefined : BUSINESS_PROFILE_SPEC.find((s) => s.key === activeTab);

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
              onClick={handleClearBusinessProfile}
              disabled={loading || generateLoading || !hasBusinessProfileContent}
              title="Remove all business profile answers, knowledge documents, and generation hint"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              Clear business profile
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
            <section className="mb-6 print:hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Company name or website (optional)
              </label>
              <input
                ref={companyHintInputRef}
                type="text"
                value={companyHint}
                onChange={(e) => {
                  setCompanyHint(e.target.value);
                  setGenerateError(null);
                }}
                placeholder="e.g. Acme Inc or https://acme.com"
                disabled={generateLoading}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-60"
              />
              <p className="mt-2 text-[11px] text-gray-500">
                Saved with your business profile. Used as optional context when you generate from documents—you do not
                need to enter it again for each run.
              </p>
            </section>

            <DescribeBusinessProfileBar onApplyDraft={handleVoiceDraft} disabled={generateLoading} />

            <section className="mb-6 print:hidden space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Generate with AI
              </h3>
              <p className="text-xs text-indigo-900/80">
                Upload one or more documents (PDF, images, Word, text, CSV, JSON). With documents, we only pre-fill
                answers the files clearly support (six section calls); other fields stay empty. If you only use a
                company name (no files), set it in the field above—general knowledge about that entity can fill the
                profile.
              </p>
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
                        {knowledgeFiles.length ? 'Add more files' : 'Choose files'}
                      </label>
                      <p className="mt-2 text-center text-[11px] text-indigo-900/70">
                        Up to {BP_GEN_MAX_FILES} files · hold Cmd/Ctrl to select several
                      </p>
                    </div>
                    {knowledgeFiles.length > 0 && (
                      <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto border-t border-indigo-100 pt-2 text-xs text-gray-800">
                        {knowledgeFiles.map((f) => (
                          <li
                            key={f.id}
                            className="rounded-md bg-white/90 px-2 py-2 ring-1 ring-gray-100"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-medium" title={f.name}>
                                {f.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeKnowledgeFile(f.id)}
                                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                            <KnowledgeDocumentUploadPreview doc={f} maxTextChars={480} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {knowledgeFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={clearKnowledgeFiles}
                        className="mt-2 text-center text-[11px] font-semibold text-indigo-800 underline hover:text-indigo-950"
                      >
                        Clear all files
                      </button>
                    )}
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
                  disabled={generateLoading || (!knowledgeFiles.length && !companyHint.trim())}
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
              {knowledgeFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(TAB_KNOWLEDGE_BASE)}
                  className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                    activeTab === TAB_KNOWLEDGE_BASE
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  Knowledge base
                </button>
              )}
            </nav>

            <div className="print:hidden space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {activeTab === TAB_KNOWLEDGE_BASE ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900">Knowledge base</h2>
                  <p className="text-sm text-gray-600">
                    Files you upload under “Generate with AI” are saved automatically. They are included when building
                    personas, running simulations, and in agent context alongside your structured profile answers.
                  </p>
                  <ul className="space-y-3">
                    {knowledgeFiles.map((f) => (
                      <li key={f.id} className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">{f.name}</p>
                            <p className="text-xs text-gray-500">{f.mimeType ?? 'Plain text'}</p>
                            <KnowledgeDocumentUploadPreview
                              doc={f}
                              density="comfortable"
                              maxTextChars={800}
                              tone="neutral"
                              className="mt-1"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeKnowledgeFile(f.id)}
                            className="shrink-0 self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : activeSection ? (
                <>
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
                </>
              ) : null}
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
