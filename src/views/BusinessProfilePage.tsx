import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  isGeminiApiKeyConfigured,
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
  getAnswerKeysForSection,
} from '../constants/businessProfileSpec.js';
import { compileBusinessProfileMarkdown } from '../utils/businessProfile.js';
import { KB_MAX_DOCS, readAndConvertToMarkdownDoc } from '../utils/knowledgeDocumentUpload.js';
import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { KnowledgeDocumentUploadPreview } from '../components/KnowledgeDocumentUploadPreview.js';

type PendingFile = {
  localId: string;
  file: File;
  status: 'queued' | 'converting' | 'error';
  error?: string;
};

type GenerateSectionProgress = {
  key: BusinessProfileSectionKey;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
};

function newLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatApproxSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `~${Math.round(chars / 1000)}k chars`;
}

function buildBpGenerationSource(
  files: BusinessProfileKnowledgeDocument[],
  companyHint: string
): BusinessProfileSectionSource {
  const textParts: string[] = [];
  const inlineFiles: { data: string; mimeType: string; name?: string }[] = [];
  for (const f of files) {
    const mt = (f.mimeType ?? '').toLowerCase();
    if (
      !mt ||
      mt.startsWith('text/') ||
      mt === 'application/json' ||
      mt === 'text/csv' ||
      mt === 'application/csv'
    ) {
      textParts.push(`--- ${f.name} ---\n${f.data}`);
    } else {
      inlineFiles.push({ data: f.data, mimeType: f.mimeType || 'application/octet-stream', name: f.name });
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const loadedRef = useRef(false);
  /** True only after GET /profile/business succeeds—blocks auto-save/unload-save from wiping server after a failed load. */
  const profileFetchOkRef = useRef(false);
  const persistPayloadRef = useRef({
    answers: {} as Record<string, string>,
    knowledgeFiles: [] as BusinessProfileKnowledgeDocument[],
    companyHint: '',
  });
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const companyHintInputRef = useRef<HTMLInputElement>(null);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<GenerateSectionProgress[] | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<BusinessProfileKnowledgeDocument[]>([]);
  const [companyHint, setCompanyHint] = useState('');
  const [selectedSections, setSelectedSections] = useState<Set<BusinessProfileSectionKey>>(
    () => new Set(),
  );
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [expandedKbDocIds, setExpandedKbDocIds] = useState<Record<string, boolean>>({});
  const [convertingFile, setConvertingFile] = useState<string | null>(null);
  const generateCancelledRef = useRef(false);
  /** Serialize markdown conversion so overlapping file picks chain instead of corrupting state. */
  const processChainRef = useRef(Promise.resolve());

  const ingestionBusy =
    processing ||
    pendingFiles.some((p) => p.status === 'queued' || p.status === 'converting');

  useVoiceTarget({
    id: 'business.save',
    label: 'Save business profile (legacy alias)',
    action: 'click',
    ref: saveBtnRef as React.RefObject<HTMLElement | null>,
    enabled: !loading && !loadError,
  });
  useVoiceTarget({
    id: fieldTargetId(businessProfileFormSchema.formKey, 'save'),
    label: 'Save business profile',
    action: 'click',
    ref: saveBtnRef as React.RefObject<HTMLElement | null>,
    enabled: !loading && !loadError,
  });
  useVoiceTarget({
    id: fieldTargetId(businessProfileFormSchema.formKey, 'company_hint'),
    label: 'Company name or website (optional)',
    action: 'fill',
    ref: companyHintInputRef as React.RefObject<HTMLElement | null>,
    enabled: !loading,
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getBusinessProfile();
      profileFetchOkRef.current = true;
      loadedRef.current = true;
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
    } catch (err) {
      profileFetchOkRef.current = false;
      loadedRef.current = true;
      setAnswers(emptyAnswers());
      setKnowledgeFiles([]);
      setCompanyHint('');
      setPendingFiles([]);
      setLoadError(err instanceof Error ? err.message : 'Could not load business profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleRetryLoadProfile = useCallback(() => {
    void loadProfile();
  }, [loadProfile]);

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

  const processPendingBatch = useCallback(
    async (batch: PendingFile[]) => {
      const toRun = batch.filter((p) => p.status === 'queued');
      if (toRun.length === 0) return;
      setGenerateError(null);
      setProcessing(true);
      try {
        for (const p of toRun) {
          setPendingFiles((prev) =>
            prev.map((x) => (x.localId === p.localId ? { ...x, status: 'converting' } : x)),
          );
          setConvertingFile(p.file.name);
          try {
            const entry = await readAndConvertToMarkdownDoc(p.file);
            setKnowledgeFiles((prev) => {
              const next = [...prev, entry];
              const { answers: a, companyHint: h } = persistPayloadRef.current;
              void persist(answersForApi(a), next, h);
              return next;
            });
            setPendingFiles((prev) => prev.filter((x) => x.localId !== p.localId));
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to read or convert file.';
            setPendingFiles((prev) =>
              prev.map((x) =>
                x.localId === p.localId ? { ...x, status: 'error', error: msg } : x,
              ),
            );
          }
        }
      } finally {
        setConvertingFile(null);
        setProcessing(false);
      }
    },
    [persist],
  );

  const scheduleProcessBatch = useCallback(
    (batch: PendingFile[]) => {
      processChainRef.current = processChainRef.current
        .catch(() => {})
        .then(() => processPendingBatch(batch));
    },
    [processPendingBatch],
  );

  useEffect(() => {
    if (!loadedRef.current || loading || !profileFetchOkRef.current) return;
    const id = window.setTimeout(() => {
      void persist(answersForApi(answers), knowledgeFiles, companyHint);
    }, 750);
    return () => window.clearTimeout(id);
  }, [answers, knowledgeFiles, companyHint, loading, persist]);

  persistPayloadRef.current = { answers, knowledgeFiles, companyHint };

  useEffect(() => {
    return () => {
      if (!loadedRef.current || !profileFetchOkRef.current) return;
      const { answers: a, knowledgeFiles: k, companyHint: h } = persistPayloadRef.current;
      void saveBusinessProfile({
        answers: answersForApi(a),
        knowledge_documents: k,
        company_hint: h.trim() ? h.trim() : null,
      }).catch(() => {});
    };
  }, []);

  const handleManualSave = () => {
    if (!profileFetchOkRef.current || loadError) return;
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
        'Clear the entire business profile? This removes all section answers, every file in your Knowledge base, and the company or website hint used for generation. This cannot be undone.',
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
        setPendingFiles([]);
        setGenerateProgress(null);
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

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const margin = 48;
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const body = mdExport || 'No answers yet.';
      const lines = doc.splitTextToSize(body, maxWidth);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      let y = margin;
      const lineHeight = 14;
      const pageBottom = doc.internal.pageSize.getHeight() - margin;
      for (const line of lines) {
        if (y > pageBottom) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      doc.save('business-profile.pdf');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create PDF.');
    }
  };

  const handleGenerateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    if (loadError || !profileFetchOkRef.current) {
      setGenerateError('Load your business profile first (fix the error above or use Retry) before uploading documents.');
      return;
    }
    setGenerateError(null);
    const slots = KB_MAX_DOCS - knowledgeFiles.length - pendingFiles.length;
    if (slots <= 0) {
      setGenerateError(`You can add at most ${KB_MAX_DOCS} files. Remove some to add more.`);
      return;
    }
    const toAdd = Array.from(list as FileList) as File[];
    const newPending: PendingFile[] = [];
    for (const f of toAdd) {
      if (newPending.length >= slots) break;
      newPending.push({ localId: newLocalId(), file: f, status: 'queued' });
    }
    if (newPending.length < toAdd.length) {
      setGenerateError(
        `Only ${slots} slot(s) left (max ${KB_MAX_DOCS} total). Extra files were not added.`,
      );
    }
    if (newPending.length === 0) return;
    setPendingFiles((prev) => [...prev, ...newPending]);
    scheduleProcessBatch(newPending);
  };

  const removePendingFile = (localId: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.localId !== localId));
    setGenerateError(null);
  };

  const handleProcessDocuments = () => {
    const queued = pendingFiles.filter((p) => p.status === 'queued');
    if (queued.length === 0) return;
    scheduleProcessBatch(queued);
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
    if (loadError || !profileFetchOkRef.current) {
      setGenerateError('Load your business profile first before generating.');
      return;
    }
    const source = buildBpGenerationSource(knowledgeFiles, companyHint);
    generateCancelledRef.current = false;
    setGenerateLoading(true);
    setGenerateError(null);
    const sectionsToRun = BUSINESS_PROFILE_SPEC.filter((s) => selectedSections.has(s.key));
    setGenerateProgress(
      sectionsToRun.map((s) => ({
        key: s.key,
        label: s.shortLabel,
        status: 'pending' as const,
      })),
    );
    let hadAnyError = false;
    try {
      for (const sec of sectionsToRun) {
        if (generateCancelledRef.current) break;
        setGenerateProgress((prev) =>
          (prev ?? []).map((row) =>
            row.key === sec.key ? { ...row, status: 'running' } : row,
          ),
        );
        const sectionKeys = getAnswerKeysForSection(sec.key);
        const existingAnswers: Record<string, string> = {};
        for (const k of sectionKeys) {
          const v = answers[k];
          if (typeof v === 'string' && v.trim()) existingAnswers[k] = v.trim();
        }
        const secSource: BusinessProfileSectionSource = {
          ...source,
          existingAnswers,
        };
        try {
          const part = await geminiService.generateBusinessProfileSection(sec.key, secSource);
          if (generateCancelledRef.current) break;
          mergeGenerated(part);
          setGenerateProgress((prev) =>
            (prev ?? []).map((row) =>
              row.key === sec.key ? { ...row, status: 'done' } : row,
            ),
          );
        } catch (err) {
          hadAnyError = true;
          const msg = err instanceof Error ? err.message : 'Generation failed.';
          setGenerateProgress((prev) =>
            (prev ?? []).map((row) =>
              row.key === sec.key ? { ...row, status: 'error', message: msg } : row,
            ),
          );
        }
      }
      if (!generateCancelledRef.current) {
        if (hadAnyError) {
          setGenerateError('One or more sections failed. See details below.');
        } else if (sectionsToRun.length > 0) {
          setSaveMessage('Generated. Review answers; auto-save will sync.');
          setTimeout(() => setSaveMessage(null), 4000);
        }
      }
    } finally {
      if (!generateCancelledRef.current) {
        setGenerateLoading(false);
      }
    }
  };

  const activeSection = BUSINESS_PROFILE_SPEC.find((s) => s.key === activeTab);

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
                onClick={() => void downloadPdf()}
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
              {saveState === 'idle' && (loadError ? 'Load required' : 'Auto-save on')}
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
        ) : (
          <>
            {loadError && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
                <p>
                  <span className="font-semibold">Could not load profile. </span>
                  {loadError}
                </p>
                <p className="mt-2 text-amber-950/90">
                  Editing, uploads, and auto-save stay off until loading succeeds so your saved answers and knowledge
                  files are not overwritten with empty data.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleRetryLoadProfile()}
                  className="mt-3 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                >
                  {loading ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            )}
            {viewFull ? (
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
                disabled={generateLoading || !!loadError}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-60"
              />
              <p className="mt-2 text-[11px] text-gray-500">
                Saved with your business profile. Used as optional context when you generate from documents—you do not
                need to enter it again for each run.
              </p>
            </section>

            <DescribeBusinessProfileBar
              onApplyDraft={handleVoiceDraft}
              disabled={generateLoading || ingestionBusy || !!loadError}
              existingAnswers={answers}
            />

            <section className="mb-6 print:hidden space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Generate with AI
              </h3>
              {!isGeminiApiKeyConfigured() && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-snug text-amber-950">
                  <span className="font-semibold">Gemini API key missing.</span> PDF, Word, and image conversion and
                  &quot;Generate with AI&quot; need <code className="rounded bg-amber-100 px-1">VITE_GEMINI_API_KEY</code>{' '}
                  in your frontend environment. Plain text, Markdown, CSV, and JSON files convert locally without it.
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSectionsOpen((o) => !o)}
                  disabled={generateLoading || processing || !!loadError}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-white px-4 py-3 text-left text-sm font-semibold text-indigo-950 shadow-sm hover:bg-indigo-50/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    Sections to fill — {selectedSections.size} of {BUSINESS_PROFILE_SPEC.length} selected
                  </span>
                  {sectionsOpen ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden />
                  )}
                </button>
                {sectionsOpen && (
                  <div className="rounded-lg border border-indigo-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      {BUSINESS_PROFILE_SPEC.map((sec) => {
                        const on = selectedSections.has(sec.key);
                        return (
                          <button
                            key={sec.key}
                            type="button"
                            disabled={generateLoading || processing || !!loadError}
                            onClick={() => {
                              setSelectedSections((prev) => {
                                const next = new Set(prev);
                                if (next.has(sec.key)) next.delete(sec.key);
                                else next.add(sec.key);
                                return next;
                              });
                            }}
                            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                              on
                                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                                : 'border-2 border-indigo-300 bg-white text-indigo-950 hover:bg-indigo-50'
                            }`}
                          >
                            {sec.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <button
                        type="button"
                        disabled={generateLoading || processing || !!loadError}
                        onClick={() =>
                          setSelectedSections(new Set(BUSINESS_PROFILE_SPEC.map((s) => s.key)))
                        }
                        className="font-semibold text-indigo-800 underline hover:text-indigo-950 disabled:opacity-40"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        disabled={generateLoading || processing || !!loadError}
                        onClick={() => setSelectedSections(new Set())}
                        className="font-semibold text-indigo-800 underline hover:text-indigo-950 disabled:opacity-40"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-indigo-200 bg-white/95 p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                  Step 1 — Upload &amp; convert
                </p>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Documents (optional, multiple)
                </label>
                <div className="flex flex-col rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 px-3 py-3">
                  <div className="flex flex-col items-center py-2">
                    <Upload className="mb-2 h-8 w-8 text-indigo-300" />
                    <input
                      type="file"
                      id="bp-gen-file"
                      className="hidden"
                      multiple
                      accept={GEMINI_FILE_INPUT_ACCEPT}
                      disabled={generateLoading || processing || !!loadError}
                      onChange={handleGenerateFileChange}
                    />
                    <label
                      htmlFor="bp-gen-file"
                      className={`rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white ${
                        generateLoading || processing || !!loadError
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:bg-indigo-700'
                      }`}
                    >
                      {knowledgeFiles.length || pendingFiles.length ? 'Add more files' : 'Choose files'}
                    </label>
                    {convertingFile && (
                      <p className="mt-2 flex items-center justify-center gap-2 text-center text-xs font-medium text-indigo-900">
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                        Converting “{convertingFile}” to Markdown…
                      </p>
                    )}
                    <p className="mt-2 text-center text-[11px] text-indigo-900/70">
                      Up to {KB_MAX_DOCS} files · conversion starts automatically after you choose files
                    </p>
                    <p className="mt-1 text-center text-[11px] text-indigo-900/70">
                      Saved Markdown appears in your{' '}
                      <Link
                        to="/knowledge-base"
                        className="font-semibold text-indigo-800 underline hover:text-indigo-950"
                      >
                        Knowledge base
                      </Link>
                      .
                    </p>
                  </div>
                </div>

                {pendingFiles.length > 0 && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-indigo-950">Upload queue</span>
                      {pendingFiles.some((p) => p.status === 'queued') && (
                        <button
                          type="button"
                          disabled={generateLoading || processing || !!loadError}
                          onClick={handleProcessDocuments}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Process queued
                        </button>
                      )}
                    </div>
                    <ul className="space-y-2 text-xs">
                      {pendingFiles.map((p) => (
                        <li
                          key={p.localId}
                          className="flex flex-col gap-1 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate font-medium text-gray-900" title={p.file.name}>
                              {p.file.name}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.status === 'queued'
                                  ? 'bg-slate-200 text-slate-800'
                                  : p.status === 'converting'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {p.status === 'queued'
                                ? 'Queued'
                                : p.status === 'converting'
                                  ? 'Converting…'
                                  : 'Error'}
                            </span>
                            {p.status === 'converting' && (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" aria-hidden />
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {p.error && (
                              <span className="max-w-[min(100%,28rem)] text-[11px] text-red-700" title={p.error}>
                                {p.error}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingFile(p.localId)}
                              disabled={p.status === 'converting' || processing}
                              className="rounded px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {knowledgeFiles.length > 0 && (
                <div className="rounded-lg border border-indigo-200 bg-white p-4 shadow-sm">
                  <h4 className="mb-3 text-sm font-semibold text-indigo-950">Processed documents (Markdown)</h4>
                  <ul className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto text-xs text-gray-800">
                    {knowledgeFiles.map((f) => {
                      const expanded = Boolean(expandedKbDocIds[f.id]);
                      return (
                        <li
                          key={f.id}
                          className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedKbDocIds((prev) => ({ ...prev, [f.id]: !prev[f.id] }))
                              }
                              className="mt-0.5 shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100"
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-gray-900" title={f.name}>
                                  {f.name}
                                </span>
                                <span className="text-[10px] font-medium text-gray-500">
                                  {formatApproxSize(f.data.length)}
                                </span>
                              </div>
                              {expanded && (
                                <KnowledgeDocumentUploadPreview
                                  doc={f}
                                  maxTextChars={20000}
                                  density="comfortable"
                                  className="mt-2"
                                />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeKnowledgeFile(f.id)}
                              className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={clearKnowledgeFiles}
                    className="mt-3 text-xs font-semibold text-indigo-800 underline hover:text-indigo-950"
                  >
                    Clear all processed files
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-indigo-200 bg-white/90 p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                  Step 2 — Generate sections
                </p>
                {generateError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {generateError}
                  </div>
                )}
                {saveMessage && !generateError && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    {saveMessage}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      generateLoading ||
                      selectedSections.size === 0 ||
                      ingestionBusy ||
                      !!loadError
                    }
                    onClick={() => void handleGenerate()}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generateLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {generateLoading ? 'Generating…' : 'Generate with AI'}
                  </button>
                  {generateLoading && (
                    <button
                      type="button"
                      onClick={() => {
                        generateCancelledRef.current = true;
                        setGenerateLoading(false);
                        setGenerateProgress(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  )}
                </div>
                {generateProgress && generateProgress.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-indigo-100 pt-3 text-xs">
                    {generateProgress.map((row) => (
                      <li
                        key={row.key}
                        className="flex flex-wrap items-start gap-2 rounded-md bg-indigo-50/60 px-3 py-2"
                      >
                        <span className="min-w-[7rem] font-semibold text-indigo-950">{row.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            row.status === 'pending'
                              ? 'bg-slate-200 text-slate-800'
                              : row.status === 'running'
                                ? 'bg-amber-100 text-amber-900'
                                : row.status === 'done'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.message && (
                          <span className="min-w-0 flex-1 text-red-700">{row.message}</span>
                        )}
                      </li>
                    ))}
                  </ul>
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
              {activeSection ? (
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
