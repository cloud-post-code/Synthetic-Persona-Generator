import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { geminiService } from '../services/gemini.js';

/** Align with backend `BP_KNOWLEDGE_MAX_DOCS` (business_profiles.knowledge_documents cap). */
export const KB_MAX_DOCS = 12;

/** Shown when a text upload has no usable body after reading from disk. */
export function emptyKnowledgeFileMessage(filename: string): string {
  return `“${filename}” has no readable text—it’s empty or whitespace only. Add content or choose a different file.`;
}

/** When the browser omits or misreports MIME type, infer plain-text handling from extension. */
function inferTextMimeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  return null;
}

function resolveMimeForTextFile(file: File): string | undefined {
  const raw = file.type?.trim();
  if (raw) return raw;
  return inferTextMimeFromFilename(file.name) ?? undefined;
}

/**
 * Whether to read the file as binary (Data URL) for Gemini multimodal conversion.
 * Treats all `text/*`, JSON/CSV, and extension-based text guesses as text (local wrap / no Gemini for conversion).
 */
export function bpFileReadsAsBinary(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('text/')) return false;
  if (t === 'application/json' || t === 'application/csv' || t === 'text/csv') return false;

  if (t.startsWith('application/pdf') || t.startsWith('image/')) return true;

  if (!t || t === 'application/octet-stream') {
    if (inferTextMimeFromFilename(file.name)) return false;
  }

  return !['text/plain', 'text/csv', 'application/json'].includes(t);
}

export async function readBpGenFile(file: File): Promise<BusinessProfileKnowledgeDocument> {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const mimeHint = resolveMimeForTextFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
    reader.onload = () => {
      const data = String(reader.result ?? '');
      if (!data.trim()) {
        reject(new Error(emptyKnowledgeFileMessage(file.name)));
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
        resolve({
          id,
          name: file.name,
          data,
          ...(mimeHint ? { mimeType: mimeHint } : {}),
        });
      }
    };
    if (bpFileReadsAsBinary(file)) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

/**
 * Read an upload and convert it to Markdown via Gemini (binary) or local wrapping (text).
 * The knowledge base stores only the `.md` result; original bytes are not retained.
 */
export async function readAndConvertToMarkdownDoc(file: File): Promise<BusinessProfileKnowledgeDocument> {
  const raw = await readBpGenFile(file);
  const md = await geminiService.convertDocumentToMarkdown({
    data: raw.data,
    mimeType: raw.mimeType,
    name: raw.name,
  });
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'document';
  return {
    id: raw.id,
    name: `${baseName}.md`,
    data: md,
    mimeType: 'text/markdown',
  };
}
