import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { geminiService, GEMINI_FILE_INPUT_ACCEPT } from '../services/gemini.js';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import type { BusinessProfile, BusinessProfileKnowledgeDocument } from '../models/types.js';
import { buildBusinessProfileGenerationSource } from '../utils/businessProfileGenerationSource.js';
import { KB_MAX_DOCS, readBpGenFile } from '../utils/knowledgeDocumentUpload.js';

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
 * Optional upload and/or company hint → Gemini fills profile fields → saves to API. Same pipeline as Business Profile page.
 */
export const BusinessProfileInlineGenerate: React.FC<BusinessProfileInlineGenerateProps> = ({
  onSaved,
  variant = 'default',
}) => {
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateDocs, setGenerateDocs] = useState<BusinessProfileKnowledgeDocument[]>([]);
  const generateDocsRef = useRef<BusinessProfileKnowledgeDocument[]>([]);
  generateDocsRef.current = generateDocs;
  const [readingFile, setReadingFile] = useState(false);
  const [companyHint, setCompanyHint] = useState('');
  const cancelledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getBusinessProfile().then((profile) => {
      if (cancelled || !profile) return;
      const hint = profile.company_hint;
      setCompanyHint(typeof hint === 'string' ? hint : '');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = input.files?.length ? (Array.from(input.files) as File[]) : [];
    if (picked.length === 0) {
      return;
    }
    setGenerateError(null);
    input.value = '';
    void (async () => {
      setReadingFile(true);
      const failures: string[] = [];
      const newDocs: BusinessProfileKnowledgeDocument[] = [];
      try {
        const room = KB_MAX_DOCS - generateDocsRef.current.length;
        if (room <= 0) {
          setGenerateError(`You can add at most ${KB_MAX_DOCS} files. Remove some before adding more.`);
          return;
        }
        const toRead = picked.slice(0, room);
        if (picked.length > room) {
          failures.push(`${picked.length - room} file(s) skipped (max ${KB_MAX_DOCS} total).`);
        }
        for (const file of toRead) {
          try {
            newDocs.push(await readBpGenFile(file));
          } catch (err) {
            failures.push(`${file.name}: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }
        if (newDocs.length) {
          setGenerateDocs((prev) => [...prev, ...newDocs]);
        }
        if (failures.length) {
          setGenerateError(failures.join('\n'));
        }
      } finally {
        setReadingFile(false);
      }
    })();
  };

  const removeDoc = (id: string) => {
    setGenerateDocs((prev) => prev.filter((d) => d.id !== id));
    setGenerateError(null);
  };

  const clearDocs = () => {
    setGenerateDocs([]);
    setGenerateError(null);
  };

  const handleGenerate = async () => {
    cancelledRef.current = false;
    const hintTrim = companyHint.trim();
    if (generateDocs.length === 0 && !hintTrim) {
      setGenerateError('Add at least one file or a company / website hint.');
      return;
    }
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      const snapshot = await getBusinessProfile();
      if (cancelledRef.current) return;
      const prebuilt = buildBusinessProfileGenerationSource(generateDocs, hintTrim);
      const merged = await geminiService.generateBusinessProfileFromDocument('', {
        prebuiltSource: prebuilt,
        ...(snapshot?.answers && Object.keys(snapshot.answers).length > 0
          ? { existingAnswers: snapshot.answers as Record<string, string> }
          : {}),
      });
      if (cancelledRef.current) return;
      const latest = await getBusinessProfile();
      const answers = mergeGeneratedIntoAnswers(latest?.answers, merged);
      const saved = await saveBusinessProfile({
        answers,
        company_hint: hintTrim ? hintTrim : null,
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
            Optionally upload decks, plans, or research (multiple files at once, up to {KB_MAX_DOCS}) and/or enter a
            company or website hint (pre-filled from your Business Profile when set there). Same pipeline as the{' '}
            <Link to="/business-profile" className="font-semibold text-indigo-700 underline hover:text-indigo-900">
              Business Profile
            </Link>{' '}
            page.
          </p>
        </div>
      </div>

      <div className="space-y-3">
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
          <p className="mt-1.5 text-[11px] text-indigo-900/70">
            Pre-filled from your Business Profile when set there; saved again when you generate so you do not have to
            re-type it each time.
          </p>
        </div>
        <div>
          <label className={labelClass}>Documents (optional)</label>
          <div className="border-4 border-dashed border-gray-100 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:border-sky-300 transition-all bg-gray-50/50 group">
            <Upload className="w-10 h-10 text-gray-300 mb-3 group-hover:text-sky-500 shrink-0" aria-hidden />
            <p className="text-sm font-bold text-gray-600 mb-3 max-w-md">
              Upload business plan, market research, or other strategy docs
            </p>
            <input
              type="file"
              id="inline-bp-generate-file"
              className="hidden"
              multiple
              accept={GEMINI_FILE_INPUT_ACCEPT}
              disabled={generateLoading || readingFile}
              onChange={handleGenerateFileChange}
            />
            <label
              htmlFor="inline-bp-generate-file"
              className={`px-8 py-3 bg-sky-600 text-white font-bold rounded-2xl shadow-lg transition-colors text-sm ${
                generateLoading || readingFile
                  ? 'cursor-not-allowed opacity-50 pointer-events-none'
                  : 'cursor-pointer hover:bg-sky-700'
              }`}
            >
              {readingFile
                ? 'Reading…'
                : generateDocs.length > 0
                  ? `Add more (${generateDocs.length}/${KB_MAX_DOCS})`
                  : 'Select Documents'}
            </label>
            {generateDocs.length > 0 && !readingFile && (
              <div className="mt-4 w-full max-w-md text-left">
                <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs">
                  {generateDocs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-gray-900" title={d.name}>
                        {d.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDoc(d.id)}
                        disabled={generateLoading}
                        className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={clearDocs}
                  disabled={generateLoading}
                  className="mt-2 text-xs font-semibold text-sky-800 underline hover:text-sky-950 disabled:opacity-40"
                >
                  Clear all files
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {generateError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {generateError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generateLoading || readingFile}
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
