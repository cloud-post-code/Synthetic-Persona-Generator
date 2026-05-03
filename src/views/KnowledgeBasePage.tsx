import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Loader2, Upload } from 'lucide-react';
import { commandBus } from '../voice/commandBus.js';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import { GEMINI_FILE_INPUT_ACCEPT } from '../services/gemini.js';
import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { KnowledgeDocumentUploadPreview } from '../components/KnowledgeDocumentUploadPreview.js';
import { KB_MAX_DOCS, readKnowledgeDocumentForStorage } from '../utils/knowledgeDocumentUpload.js';

function normalizeDocs(raw: unknown): BusinessProfileKnowledgeDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is BusinessProfileKnowledgeDocument =>
      !!d &&
      typeof d === 'object' &&
      typeof (d as BusinessProfileKnowledgeDocument).id === 'string' &&
      typeof (d as BusinessProfileKnowledgeDocument).name === 'string' &&
      typeof (d as BusinessProfileKnowledgeDocument).data === 'string' &&
      (d as BusinessProfileKnowledgeDocument).id.trim() !== '' &&
      (d as BusinessProfileKnowledgeDocument).name.trim() !== '' &&
      (d as BusinessProfileKnowledgeDocument).data !== '',
  );
}

const KnowledgeBasePage: React.FC = () => {
  const [docs, setDocs] = useState<BusinessProfileKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const uploadNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  /** True only after a successful GET so we never auto-save or unload-save empty state over the server. */
  const profileFetchOkRef = useRef(false);
  const docsRef = useRef<BusinessProfileKnowledgeDocument[]>([]);

  const loadKnowledgeBase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getBusinessProfile();
      profileFetchOkRef.current = true;
      loadedRef.current = true;
      setDocs(normalizeDocs(profile?.knowledge_documents));
    } catch (err) {
      profileFetchOkRef.current = false;
      loadedRef.current = true;
      setDocs([]);
      setLoadError(err instanceof Error ? err.message : 'Could not load knowledge base.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  const handleRetryLoad = useCallback(() => {
    void loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  const persist = useCallback(async (nextDocs: BusinessProfileKnowledgeDocument[]) => {
    setSaveState('saving');
    setSaveMessage(null);
    try {
      await saveBusinessProfile({ knowledge_documents: nextDocs });
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
    if (!loadedRef.current || loading || !profileFetchOkRef.current) return;
    const id = window.setTimeout(() => {
      void persist(docs);
    }, 750);
    return () => window.clearTimeout(id);
  }, [docs, loading, persist]);

  docsRef.current = docs;

  useEffect(() => {
    return () => {
      if (!loadedRef.current || !profileFetchOkRef.current) return;
      void saveBusinessProfile({ knowledge_documents: docsRef.current }).catch(() => {});
    };
  }, []);

  const showUploadNotice = useCallback((message: string) => {
    if (uploadNoticeTimerRef.current) clearTimeout(uploadNoticeTimerRef.current);
    setUploadNotice(message);
    uploadNoticeTimerRef.current = setTimeout(() => {
      setUploadNotice(null);
      uploadNoticeTimerRef.current = null;
    }, 6000);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) {
      showUploadNotice('No file was selected — nothing was added.');
      return;
    }
    if (loadError || !profileFetchOkRef.current) {
      setUploadError('Your documents could not be loaded from the server. Fix the issue above and use Retry before uploading.');
      return;
    }
    setUploadError(null);
    setUploadNotice(null);
    if (uploadNoticeTimerRef.current) {
      clearTimeout(uploadNoticeTimerRef.current);
      uploadNoticeTimerRef.current = null;
    }
    let remaining = KB_MAX_DOCS - docs.length;
    if (remaining <= 0) {
      setUploadError(`You can add at most ${KB_MAX_DOCS} files. Remove some to add more.`);
      return;
    }
    const toAdd = Array.from(list as FileList) as File[];
    const added: BusinessProfileKnowledgeDocument[] = [];
    const failures: string[] = [];
    let skippedDueToLimit = 0;
    try {
      for (const f of toAdd) {
        if (remaining <= 0) {
          skippedDueToLimit += 1;
          continue;
        }
        setReadingFile(f.name);
        try {
          const entry = await readKnowledgeDocumentForStorage(f);
          added.push(entry);
          remaining -= 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to read file.';
          failures.push(`${f.name}: ${msg}`);
        }
      }
      const limitMsg =
        skippedDueToLimit > 0
          ? `${skippedDueToLimit} file(s) were not added — maximum is ${KB_MAX_DOCS} documents. Remove one or more files to add more.`
          : '';
      if (failures.length > 0 || limitMsg) {
        const parts = [...failures, ...(limitMsg ? [limitMsg] : [])];
        if (added.length > 0) {
          parts.push(
            added.length === 1
              ? '1 other file was added and saved successfully.'
              : `${added.length} other files were added and saved successfully.`,
          );
        }
        setUploadError(parts.join('\n'));
      } else if (added.length > 0) {
        showUploadNotice(
          added.length === 1
            ? `Added 1 file and saved to your library.`
            : `Added ${added.length} files and saved to your library.`,
        );
      }
      if (added.length > 0) {
        setDocs((prev) => {
          const next = [...prev, ...added];
          void persist(next);
          return next;
        });
      }
    } finally {
      setReadingFile(null);
    }
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => {
      const removed = prev.find((f) => f.id === id);
      const next = prev.filter((f) => f.id !== id);
      if (removed) {
        showUploadNotice(`“${removed.name}” was removed. It is no longer in your library (saving…).`);
      }
      return next;
    });
    setUploadError(null);
  };

  const saveBadge = useMemo(() => {
    return (
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
    );
  }, [loadError, saveMessage, saveState]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Knowledge base</h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500">
              Files are stored as you upload them and shared with{' '}
              <Link to="/business-profile" className="font-semibold text-indigo-600 hover:text-indigo-800">
                Business Profile
              </Link>{' '}
              for AI generation, persona builder, and simulations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{saveBadge}</div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-6">
            {loadError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>
                  <span className="font-semibold">Could not load documents. </span>
                  {loadError}
                </p>
                <p className="mt-2 text-amber-950/90">
                  Uploads are disabled until loading succeeds—otherwise saves can fail and nothing will stick.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleRetryLoad()}
                  className="mt-3 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                >
                  {loading ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <input
                type="file"
                id="kb-add-files"
                className="hidden"
                multiple
                accept={GEMINI_FILE_INPUT_ACCEPT}
                disabled={readingFile != null || !!loadError || loading}
                onChange={(ev) => void handleFileChange(ev)}
              />
              <label
                htmlFor="kb-add-files"
                className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ${
                  readingFile != null || !!loadError || loading
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-indigo-700'
                }`}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Add documents
              </label>
              <span className="text-xs text-gray-500">
                Up to {KB_MAX_DOCS} files · PDF, images, Word, text, CSV, JSON
              </span>
              {readingFile && (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-800">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  Reading “{readingFile}”…
                </span>
              )}
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 whitespace-pre-wrap rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {uploadError}
              </div>
            )}
            {uploadNotice && !uploadError && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {uploadNotice}
              </div>
            )}

            {docs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-300" aria-hidden />
                <p className="mb-4 text-sm text-gray-600">No documents yet. Add files to build your library.</p>
                <label
                  htmlFor="kb-add-files-empty"
                  className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ${
                    readingFile != null || !!loadError || loading
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-indigo-700'
                  }`}
                >
                  Choose files
                </label>
                <input
                  type="file"
                  id="kb-add-files-empty"
                  className="hidden"
                  multiple
                  accept={GEMINI_FILE_INPUT_ACCEPT}
                  disabled={readingFile != null || !!loadError || loading}
                  onChange={(ev) => void handleFileChange(ev)}
                />
              </div>
            ) : (
              <ul className="space-y-4">
                {docs.map((f) => (
                  <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-500">{f.mimeType ?? 'Plain text'}</p>
                        <KnowledgeDocumentUploadPreview
                          doc={f}
                          density="comfortable"
                          maxTextChars={800}
                          tone="neutral"
                          className="mt-2"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(f.id)}
                        className="shrink-0 self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
