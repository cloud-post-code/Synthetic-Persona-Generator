import type { SurveyQuestion } from '../services/simulationTemplateApi.js';

/**
 * Remove legacy overall and per-item "Summary:" blocks so the UI shows one executive summary from a separate API call.
 */
export function stripSurveySummaryBlocks(raw: string): string {
  const lines = (raw ?? '').replace(/^\uFEFF/, '').split('\n');
  const out: string[] = [];
  let seenFirstQuestion = false;
  let skippingItemSummary = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tr = line.trim();

    if (!seenFirstQuestion) {
      if (/^Question:/i.test(tr)) {
        seenFirstQuestion = true;
        out.push(line);
        continue;
      }
      if (/^Summary:/i.test(tr)) continue;
      if (tr === '') continue;
      out.push(line);
      continue;
    }

    if (skippingItemSummary) {
      if (/^Answer:/i.test(tr)) {
        skippingItemSummary = false;
        out.push(line);
      }
      continue;
    }
    if (/^Summary:/i.test(tr)) {
      skippingItemSummary = true;
      continue;
    }
    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function getStoredSurveyQuestions(sessionId: string | null): SurveyQuestion[] {
  if (!sessionId) return [];
  try {
    const raw = localStorage.getItem(`simulationSurveyData_${sessionId}`);
    if (!raw) return [];
    const p = JSON.parse(raw) as { questions?: SurveyQuestion[] };
    return Array.isArray(p.questions) ? p.questions : [];
  } catch {
    return [];
  }
}

function questionLabel(questions: SurveyQuestion[] | null | undefined, index: number): string {
  const q = questions?.[index]?.question?.trim();
  return q || `Question ${index + 1}`;
}

function extractTopSummary(o: Record<string, unknown>): string {
  for (const k of ['summary', 'overview', 'executive_summary'] as const) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function objectStringFieldsToQA(o: Record<string, unknown>): string | null {
  const top = extractTopSummary(o);
  const head = top ? `Summary:\n${top}\n\n` : '';
  const lines: string[] = [];
  const skip = new Set(['thinking', 'reasoning', 'notes', 'metadata', 'summary', 'overview', 'executive_summary']);
  for (const [k, v] of Object.entries(o)) {
    if (skip.has(k)) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      lines.push(`Question: ${k}`, `Answer: ${String(v)}`, '');
    }
  }
  const body = lines.join('\n').trim();
  if (!head && !body) return null;
  return (head + body).trim();
}

/** Turn parsed JSON survey payloads into plain Q&A blocks. */
function jsonSurveyToPlainText(parsed: unknown, questions?: SurveyQuestion[] | null): string | null {
  if (parsed == null) return null;

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && parsed.every((x) => typeof x === 'string' || typeof x === 'number')) {
      const lines: string[] = [];
      (parsed as unknown[]).forEach((a, i) => {
        lines.push(`Question: ${questionLabel(questions, i)}`, `Answer: ${String(a)}`, '');
      });
      return lines.join('\n').trim();
    }
    const lines: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const o = row as Record<string, unknown>;
        const q = String(o.question ?? o.q ?? o.text ?? o.prompt ?? '').trim();
        const sum = String(o.summary ?? o.Summary ?? '').trim();
        const a = String(o.answer ?? o.response ?? o.value ?? o.a ?? '').trim();
        if (q || a || sum) {
          lines.push(`Question: ${q || questionLabel(questions, i)}`);
          if (sum) lines.push(`Summary: ${sum}`);
          lines.push(`Answer: ${a || '—'}`, '');
        }
      } else if (typeof row === 'string') {
        lines.push(`Question: ${questionLabel(questions, i)}`, `Answer: ${row}`, '');
      }
    }
    return lines.length ? lines.join('\n').trim() : null;
  }

  if (typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;

  if (Array.isArray(o.questions) && Array.isArray(o.answers)) {
    const qs = o.questions as unknown[];
    const as = o.answers as unknown[];
    const sums = Array.isArray(o.summaries) ? (o.summaries as unknown[]) : null;
    const n = Math.max(qs.length, as.length);
    if (n === 0) return null;
    const top = extractTopSummary(o);
    const head = top ? `Summary:\n${top}\n\n` : '';
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const qRaw = qs[i];
      const q =
        typeof qRaw === 'string'
          ? qRaw.trim()
          : qRaw && typeof qRaw === 'object'
            ? String((qRaw as { question?: string }).question ?? '').trim()
            : '';
      const a = as[i] != null ? String(as[i]).trim() : '';
      const sum = sums?.[i] != null ? String(sums[i]).trim() : '';
      lines.push(`Question: ${q || questionLabel(questions, i)}`);
      if (sum) lines.push(`Summary: ${sum}`);
      lines.push(`Answer: ${a || '—'}`, '');
    }
    return (head + lines.join('\n')).trim();
  }

  for (const key of ['responses', 'results', 'data', 'items', 'surveyResponses'] as const) {
    const v = o[key];
    if (Array.isArray(v)) {
      const nested = jsonSurveyToPlainText(v, questions);
      if (nested) return nested;
    }
  }

  const answersOnly = o.answers;
  if (Array.isArray(answersOnly) && answersOnly.every((x) => typeof x === 'string' || typeof x === 'number')) {
    const top = extractTopSummary(o);
    const head = top ? `Summary:\n${top}\n\n` : '';
    const lines: string[] = [];
    (answersOnly as unknown[]).forEach((a, i) => {
      lines.push(`Question: ${questionLabel(questions, i)}`, `Answer: ${String(a)}`, '');
    });
    return (head + lines.join('\n')).trim();
  }

  const numericKeys = Object.keys(o)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length > 0) {
    const top = extractTopSummary(o);
    const head = top ? `Summary:\n${top}\n\n` : '';
    const lines: string[] = [];
    numericKeys.forEach((k, idx) => {
      const a = String(o[k] ?? '').trim();
      lines.push(`Question: ${questionLabel(questions, idx)}`, `Answer: ${a || '—'}`, '');
    });
    return (head + lines.join('\n')).trim();
  }

  return null;
}

function tryParseJsonValue(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const iBrace = t.indexOf('{');
    const iBracket = t.indexOf('[');
    if (iBracket >= 0 && (iBrace < 0 || iBracket < iBrace)) {
      const j = t.lastIndexOf(']');
      if (j > iBracket) {
        try {
          return JSON.parse(t.slice(iBracket, j + 1));
        } catch {
          /* fall through */
        }
      }
    }
    if (iBrace >= 0) {
      const j = t.lastIndexOf('}');
      if (j > iBrace) {
        try {
          return JSON.parse(t.slice(iBrace, j + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

/**
 * Present survey simulation output as readable Question / Answer text.
 * If the model returned JSON (legacy or mistake), convert it—never show raw JSON to users.
 */
export function formatSurveySimulationContent(
  raw: string,
  questions?: SurveyQuestion[] | null
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  let candidate = trimmed.replace(/^\uFEFF/, '');
  const fenced = candidate.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) candidate = fenced[1].trim();

  const looksJson =
    (candidate.startsWith('{') && candidate.includes('}')) || (candidate.startsWith('[') && candidate.includes(']'));
  if (looksJson) {
    const parsed = tryParseJsonValue(candidate);
    if (parsed !== null) {
      const qa = jsonSurveyToPlainText(parsed, questions);
      if (qa) return stripSurveySummaryBlocks(qa);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const flat = objectStringFieldsToQA(parsed as Record<string, unknown>);
        if (flat) return stripSurveySummaryBlocks(flat);
      }
    }
  }

  return stripSurveySummaryBlocks(trimmed);
}
