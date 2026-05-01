/** Normalized token counts from a Gemini generateContent response. */

export type NormalizedGeminiUsage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/**
 * Reads usageMetadata from @google/genai GenerateContentResponse (camelCase fields).
 * Prefers totalTokenCount; else prompt + candidates + thoughtsTokenCount when present.
 */
export function normalizeUsageMetadata(raw: unknown): NormalizedGeminiUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const prompt = num(u.promptTokenCount);
  const candidates = num(u.candidatesTokenCount);
  const totalDirect = num(u.totalTokenCount);
  const thoughts = num(u.thoughtsTokenCount);
  const total =
    totalDirect > 0 ? totalDirect : prompt + candidates + (thoughts > 0 ? thoughts : 0);
  if (prompt === 0 && candidates === 0 && total === 0) return null;
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: total > 0 ? total : prompt + candidates,
  };
}

export function mergeUsage(
  a: NormalizedGeminiUsage | null | undefined,
  b: NormalizedGeminiUsage | null | undefined
): NormalizedGeminiUsage {
  const x = a ?? { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  const y = b ?? { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  return {
    promptTokenCount: x.promptTokenCount + y.promptTokenCount,
    candidatesTokenCount: x.candidatesTokenCount + y.candidatesTokenCount,
    totalTokenCount: x.totalTokenCount + y.totalTokenCount,
  };
}
