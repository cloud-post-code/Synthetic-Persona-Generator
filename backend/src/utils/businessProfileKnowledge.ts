import type { BusinessProfileKnowledgeDocument } from '../types/index.js';

export const BP_KNOWLEDGE_MAX_DOCS = 12;

export function parseKnowledgeDocumentsJson(raw: unknown): BusinessProfileKnowledgeDocument[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: BusinessProfileKnowledgeDocument[] = [];
  for (const item of raw) {
    if (out.length >= BP_KNOWLEDGE_MAX_DOCS) break;
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 512) : '';
    const data = typeof o.data === 'string' ? o.data : '';
    const mimeType = typeof o.mimeType === 'string' ? o.mimeType.trim() : undefined;
    if (!id || !name || !data) continue;
    out.push({ id, name, data, ...(mimeType ? { mimeType } : {}) });
  }
  return out;
}
