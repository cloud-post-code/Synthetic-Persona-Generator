import type { BusinessProfileKnowledgeDocument } from '../models/types.js';
import { geminiService } from '../services/gemini.js';

/** Align with backend `BP_KNOWLEDGE_MAX_DOCS` (business_profiles.knowledge_documents cap). */
export const KB_MAX_DOCS = 12;

export function bpFileReadsAsBinary(file: File): boolean {
  const t = file.type || '';
  if (t.startsWith('application/pdf') || t.startsWith('image/')) return true;
  return !['text/plain', 'text/csv', 'application/json'].includes(t);
}

export async function readBpGenFile(file: File): Promise<BusinessProfileKnowledgeDocument> {
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
