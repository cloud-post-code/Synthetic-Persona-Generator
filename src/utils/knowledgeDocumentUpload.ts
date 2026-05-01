import type { BusinessProfileKnowledgeDocument } from '../models/types.js';

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
