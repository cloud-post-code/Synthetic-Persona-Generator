/**
 * Extract plain text from a stored business knowledge document for prompts.
 * Binary uploads return null — Gemini generation still uses raw `data` in the browser.
 */
export function extractKnowledgeDocumentText(doc: {
  data: string;
  mimeType?: string;
}): string | null {
  const { data, mimeType } = doc;
  if (!data?.trim()) return null;
  if (!mimeType) return data;
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/csv'
  ) {
    if (data.startsWith('data:')) {
      const i = data.indexOf(',');
      if (i === -1) return null;
      const b64 = data.slice(i + 1);
      try {
        return atob(b64);
      } catch {
        return null;
      }
    }
    return data;
  }
  return null;
}

export type KnowledgeDocumentUploadPreview =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'image'; src: string }
  | { kind: 'binary'; mimeLabel: string };

/**
 * What to show after upload: text snippet, image thumbnail, or a short note for PDF/other binary.
 */
export function getKnowledgeDocumentUploadPreview(
  doc: { data: string; mimeType?: string },
  options?: { maxTextChars?: number },
): KnowledgeDocumentUploadPreview | null {
  if (!doc.data?.trim()) return null;
  const maxTextChars = options?.maxTextChars ?? 500;
  const mime = doc.mimeType ?? '';
  if (mime.startsWith('image/') && doc.data.startsWith('data:')) {
    return { kind: 'image', src: doc.data };
  }
  const fullText = extractKnowledgeDocumentText(doc);
  if (fullText?.trim()) {
    const t = fullText.trim();
    const truncated = t.length > maxTextChars;
    return {
      kind: 'text',
      text: truncated ? t.slice(0, maxTextChars) : t,
      truncated,
    };
  }
  return { kind: 'binary', mimeLabel: mime || 'Binary file' };
}
