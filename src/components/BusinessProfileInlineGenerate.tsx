import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { geminiService, GEMINI_FILE_INPUT_ACCEPT } from '../services/gemini.js';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import type { BusinessProfile } from '../models/types.js';
import { KnowledgeDocumentUploadPreview } from './KnowledgeDocumentUploadPreview.js';

export type BusinessProfileInlineGenerateProps = {
  onSaved: (profile: BusinessProfile) => void;
  /** Tighter layout for simulation / build flows */
  variant?: 'default' | 'compact';
};

function mergeGeneratedIntoAnswers(
  existing: Record<string, string> | undefined,
  result: Record<string, string | null>
): Record<string, string> {
  const base = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(result)) {
    if (v != null && String(v).trim() !== '') base[k] = String(v).trim();
  }
  return base;
}

/**
 * Upload + company hint → Gemini fills profile fields → saves to API. Same pipeline as Business Profile page.
 */
export const BusinessProfileInlineGenerate: React.FC<BusinessProfileInlineGenerateProps> = ({
  onSaved,
  variant = 'default',
}) => {
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateFileName, setGenerateFileName] = useState('');
  const [generateFileData, setGenerateFileData] = useState<{ data: string; mimeType?: string } | null>(null);
  const [companyHint, setCompanyHint] = useState('');
  const cancelledRef = useRef(false);

  const handleGenerateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setGenerateFileName('');
      setGenerateFileData(null);
      return;
    }
    setGenerateFileName(file.name);
    setGenerateError(null);
    const mime = file.type || '';
    const isBinary =
      mime === 'application/pdf' ||
      mime.startsWith('image/') ||
      (!['text/plain', 'text/csv', 'application/json'].includes(mime) && mime !== '');
    if (isBinary || !['text/plain', 'text/csv', 'application/json'].includes(mime)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGenerateFileData({
          data: (ev.target?.result as string) || '',
          mimeType: mime || 'application/octet-stream',
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGenerateFileData({ data: (ev.target?.result as string) || '' });
      };
      reader.readAsText(file);
    }
  };

  const handleGenerate = async () => {
    if (!generateFileData?.data && !companyHint.trim()) {
      setGenerateError('Add a document and/or a company name or website to generate from.');
      return;
    }
    cancelledRef.current = false;
    setGenerateLoading(true);
    setGenerateError(null);
    const opts = { mimeType: generateFileData?.mimeType, companyHint: companyHint.trim() || undefined };
    const input = generateFileData?.data ?? companyHint.trim();
    try {
      const merged = await geminiService.generateBusinessProfileFromDocument(input, opts);
      if (cancelledRef.current) return;
      const current = await getBusinessProfile();
      const answers = mergeGeneratedIntoAnswers(current?.answers, merged);
      const saved = await saveBusinessProfile({
        answers,
        knowledge_documents: current?.knowledge_documents,
      });
      if (cancelledRef.current) return;
      onSaved(saved);
    } catch (err) {
      if (!cancelledRef.current) {
        setGenerateError(err instanceof Error ? err.message : 'Failed to generate Business Profile.');
      }
    } finally {
      if (!cancelledRef.current) setGenerateLoading(false);
    }
  };

  const pad = variant === 'compact' ? 'p-4' : 'p-6';
  const labelClass =
    variant === 'compact'
      ? 'block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5'
      : 'block text-sm font-black text-gray-400 uppercase tracking-widest mb-2';

  return (
    <div className={`rounded-2xl border border-indigo-100 bg-indigo-50/40 ${pad} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            Generate with AI
          </h4>
          <p className="text-xs text-indigo-800/80 mt-1 max-w-xl">
            Upload a deck, plan, or 10-K, and/or enter a company name or website. With files, we only fill answers
            those sources support; other fields stay as they are. Same pipeline as the{' '}
            <Link to="/business-profile" className="font-semibold text-indigo-700 underline hover:text-indigo-900">
              Business Profile
            </Link>{' '}
            page.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Document (optional)</label>
          <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 flex flex-col items-center text-center bg-white/60">
            <Upload className="w-8 h-8 text-indigo-300 mb-2" />
            <input
              type="file"
              id="inline-bp-generate-file"
              className="hidden"
              accept={GEMINI_FILE_INPUT_ACCEPT}
              onChange={handleGenerateFileChange}
            />
            <label
              htmlFor="inline-bp-generate-file"
              className="cursor-pointer px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
            >
              {generateFileName || 'Select document'}
            </label>
            {generateFileData?.data ? (
              <div className="mt-3 w-full text-left">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Uploaded sample</p>
                <KnowledgeDocumentUploadPreview
                  doc={{
                    data: generateFileData.data,
                    mimeType: generateFileData.mimeType,
                    name: generateFileName || undefined,
                  }}
                  maxTextChars={520}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <label className={labelClass}>Company name or website (optional)</label>
          <input
            type="text"
            value={companyHint}
            onChange={(e) => {
              setCompanyHint(e.target.value);
              setGenerateError(null);
            }}
            placeholder="e.g. Acme Inc or https://acme.com"
            className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
      </div>

      {generateError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{generateError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generateLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
        >
          {generateLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate & save profile
            </>
          )}
        </button>
        {generateLoading && (
          <button
            type="button"
            onClick={() => {
              cancelledRef.current = true;
              setGenerateLoading(false);
            }}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
