import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { commandBus } from '../voice/commandBus.js';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import { GEMINI_FILE_INPUT_ACCEPT } from '../services/gemini.js';
import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { KnowledgeDocumentUploadPreview } from '../components/KnowledgeDocumentUploadPreview.js';
import { KB_MAX_DOCS, readAndConvertToMarkdownDoc } from '../utils/knowledgeDocumentUpload.js';

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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [convertingFile, setConvertingFile] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBusinessProfile()
      .then((profile) => {
        if (cancelled) return;
        setDocs(normalizeDocs(profile?.knowledge_documents));
        loadedRef.current = true;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!loadedRef.current || loading) return;
    const id = window.setTimeout(() => {
      void persist(docs);
    }, 750);
    return () => window.clearTimeout(id);
  }, [docs, loading, persist]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    setUploadError(null);
    let remaining = KB_MAX_DOCS - docs.length;
    if (remaining <= 0) {
      setUploadError(`You can add at most ${KB_MAX_DOCS} files. Remove some to add more.`);
      return;
    }
    const toAdd = Array.from(list as FileList) as File[];
    try {
      for (const f of toAdd) {
        if (remaining <= 0) break;
        setConvertingFile(f.name);
        const entry = await readAndConvertToMarkdownDoc(f);
        setDocs((prev) => [...prev, entry]);
        remaining -= 1;
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to read or convert file.');
    } finally {
      setConvertingFile(null);
    }
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((f) => f.id !== id));
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
        {saveState === 'idle' && 'Auto-save on'}
      </span>
    );
  }, [saveMessage, saveState]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Knowledge base</h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500">
              Each upload is converted to Markdown and stored here. The same library is used under{' '}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <input
                type="file"
                id="kb-add-files"
                className="hidden"
                multiple
                accept={GEMINI_FILE_INPUT_ACCEPT}
                disabled={convertingFile != null}
                onChange={(ev) => void handleFileChange(ev)}
              />
              <label
                htmlFor="kb-add-files"
                className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ${
                  convertingFile != null
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-indigo-700'
                }`}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Add documents
              </label>
              <span className="text-xs text-gray-500">
                Up to {KB_MAX_DOCS} files · PDF, images, Word, text, CSV, JSON (saved as Markdown)
              </span>
              {convertingFile && (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-800">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  Converting “{convertingFile}”…
                </span>
              )}
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {uploadError}
              </div>
            )}

            {docs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-300" aria-hidden />
                <p className="mb-4 text-sm text-gray-600">No documents yet. Add files to build your library.</p>
                <label
                  htmlFor="kb-add-files-empty"
                  className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ${
                    convertingFile != null
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
                  disabled={convertingFile != null}
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
