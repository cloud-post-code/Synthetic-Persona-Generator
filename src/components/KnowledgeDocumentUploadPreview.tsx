import React from 'react';
import {
  getKnowledgeDocumentUploadPreview,
  type KnowledgeDocumentUploadPreview as PreviewModel,
} from '../utils/knowledgeDocumentText.js';

type DocShape = { data: string; mimeType?: string; name?: string };

export type KnowledgeDocumentUploadPreviewProps = {
  doc: DocShape;
  /** Default 500 */
  maxTextChars?: number;
  /** Tighter typography and height for stacked file lists */
  density?: 'compact' | 'comfortable';
  /** `neutral` for gray borders (e.g. Knowledge base tab) */
  tone?: 'indigo' | 'neutral';
  className?: string;
};

function shortBinaryLabel(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.startsWith('application/vnd.')) return 'Office document';
  if (m.startsWith('application/msword')) return 'Word';
  return m.split('/').pop() || 'This file type';
}

function renderPreview(
  preview: PreviewModel,
  density: 'compact' | 'comfortable',
  tone: 'indigo' | 'neutral',
): React.ReactNode {
  const preMax = density === 'compact' ? 'max-h-28' : 'max-h-48';
  const imgMax = density === 'compact' ? 'max-h-28' : 'max-h-40';
  const frame =
    tone === 'neutral' ? 'border-gray-200 bg-white' : 'border-indigo-100/80 bg-white';

  if (preview.kind === 'text') {
    return (
      <pre
        className={`mt-1.5 overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-2 font-sans text-[11px] leading-snug text-gray-800 ${frame} ${preMax}`}
      >
        {preview.text}
        {preview.truncated ? '…' : ''}
      </pre>
    );
  }
  if (preview.kind === 'image') {
    return (
      <div className={`mt-1.5 overflow-hidden rounded-md border p-1 ${frame} ${imgMax}`}>
        <img src={preview.src} alt="" className="mx-auto max-h-full w-auto object-contain" />
      </div>
    );
  }
  const kind = shortBinaryLabel(preview.mimeLabel);
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
      {kind}: no text preview here. The file is stored and used when you run Generate from document.
    </p>
  );
}

export function KnowledgeDocumentUploadPreview({
  doc,
  maxTextChars,
  density = 'compact',
  tone = 'indigo',
  className = '',
}: KnowledgeDocumentUploadPreviewProps) {
  const preview = getKnowledgeDocumentUploadPreview(doc, { maxTextChars });
  if (!preview) return null;
  const densityResolved: 'compact' | 'comfortable' = density === 'comfortable' ? 'comfortable' : 'compact';
  const toneResolved: 'indigo' | 'neutral' = tone === 'neutral' ? 'neutral' : 'indigo';
  return <div className={className}>{renderPreview(preview, densityResolved, toneResolved)}</div>;
}
