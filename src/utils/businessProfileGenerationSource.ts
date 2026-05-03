import type { BusinessProfileSectionSource } from '../services/gemini.js';
import type { BusinessProfileKnowledgeDocument } from '../models/types.js';

/** Build Gemini section source from uploaded docs + optional company hint (session-only uploads). */
export function buildBusinessProfileGenerationSource(
  files: BusinessProfileKnowledgeDocument[],
  companyHint: string
): BusinessProfileSectionSource {
  const textParts: string[] = [];
  const inlineFiles: { data: string; mimeType: string; name?: string }[] = [];
  for (const f of files) {
    const mt = (f.mimeType ?? '').toLowerCase();
    if (
      !mt ||
      mt.startsWith('text/') ||
      mt === 'application/json' ||
      mt === 'text/csv' ||
      mt === 'application/csv'
    ) {
      textParts.push(`--- ${f.name} ---\n${f.data}`);
    } else {
      inlineFiles.push({ data: f.data, mimeType: f.mimeType || 'application/octet-stream', name: f.name });
    }
  }
  const hint = companyHint.trim();
  const fileText = textParts.length ? textParts.join('\n\n') : '';
  const textCorpus = fileText || (hint && files.length === 0 ? hint : undefined);
  return {
    companyHint: hint || undefined,
    textCorpus,
    inlineFiles: inlineFiles.length ? inlineFiles : undefined,
  };
}
