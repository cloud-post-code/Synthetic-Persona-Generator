/**
 * Extract plain text from a stored business knowledge document for prompts / embeddings.
 * Binary uploads (PDF, images, etc.) return null — generation still uses raw `data` client-side.
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
        return Buffer.from(b64, 'base64').toString('utf8');
      } catch {
        return null;
      }
    }
    return data;
  }
  return null;
}
