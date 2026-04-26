/**
 * If the model returned JSON (or fenced ```json), convert to readable plain text
 * so the UI never shows raw structured payloads for any simulation type.
 */

function tryParseJsonValue(text: string): unknown | null {
  const t = text.trim();
  if (!t) return null;
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

function formatParsedValue(v: unknown, depth = 0): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  const pad = '  '.repeat(depth);
  if (Array.isArray(v)) {
    if (v.length === 0) return '(empty)';
    return v
      .map((item, i) => {
        if (item !== null && typeof item === 'object') {
          return `${pad}${i + 1}.\n${formatParsedValue(item, depth + 1)}`;
        }
        return `${pad}${i + 1}. ${formatParsedValue(item, 0)}`;
      })
      .join('\n');
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.entries(o)
      .map(([k, val]) => {
        if (val !== null && typeof val === 'object') {
          return `${pad}${k}:\n${formatParsedValue(val, depth + 1)}`;
        }
        return `${pad}${k}: ${formatParsedValue(val, 0)}`;
      })
      .join('\n');
  }
  return String(v);
}

export function ensureSimulationPlainText(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  let candidate = trimmed.replace(/^\uFEFF/, '');
  const fenced = candidate.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) candidate = fenced[1].trim();

  const looksStructured =
    (candidate.startsWith('{') && candidate.includes('}')) || (candidate.startsWith('[') && candidate.includes(']'));
  if (!looksStructured) return raw;

  const parsed = tryParseJsonValue(candidate);
  if (parsed === null) return fenced ? candidate : raw;
  return formatParsedValue(parsed).trim();
}
