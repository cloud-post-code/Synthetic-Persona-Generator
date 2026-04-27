import type { Persona } from '../models/types.js';
import type { AgentPipelineEvent, RetrievalInfo, ValidationInfo } from '../services/agentApi.js';
import type { SurveyQuestion } from '../services/simulationTemplateApi.js';

export type SlimPersonaResult = {
  personaId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  content: string;
  _storageTruncated?: boolean;
};

const SIMULATION_STORAGE_PREFIXES = [
  'simulationPersonaResults_',
  'simulationMessages_',
  'simulationPersona_',
  'simulationSurveyData_',
  'simulationPersonas_',
] as const;

function sessionIdFromSimulationStorageKey(key: string): string | null {
  for (const p of SIMULATION_STORAGE_PREFIXES) {
    if (key.startsWith(p)) {
      const id = key.slice(p.length);
      return id || null;
    }
  }
  return null;
}

/** Remove cached simulation keys for other sessions to free quota. */
export function evictSimulationLocalStorageExcept(keepSessionId: string): number {
  let removed = 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) {
    const sid = sessionIdFromSimulationStorageKey(k);
    if (!sid || sid === keepSessionId) continue;
    try {
      localStorage.removeItem(k);
      removed++;
    } catch {
      /* ignore */
    }
  }
  if (removed) console.warn(`[localStorage] Evicted ${removed} simulation cache key(s) for other sessions.`);
  return removed;
}

/** Last resort: clear all simulation-related cache keys (frees origin quota for a new write). */
export function hardEvictAllSimulationLocalStorage(): number {
  let removed = 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) {
    if (!SIMULATION_STORAGE_PREFIXES.some((p) => k.startsWith(p))) continue;
    try {
      localStorage.removeItem(k);
      removed++;
    } catch {
      /* ignore */
    }
  }
  if (removed) console.warn(`[localStorage] Hard-evicted ${removed} simulation cache key(s).`);
  return removed;
}

function trySetItemOnce(key: string, json: string): boolean {
  try {
    localStorage.setItem(key, json);
    return true;
  } catch (e) {
    const isQuota =
      (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)) ||
      (e as Error)?.name === 'QuotaExceededError';
    if (isQuota) {
      console.warn(`[localStorage] Quota exceeded for key ${key} (${(json.length / 1024).toFixed(0)} KB)`);
    } else {
      console.warn(`[localStorage] setItem failed for ${key}:`, e);
    }
    return false;
  }
}

/** Try write; on quota evict other sessions, then all simulation keys, then retry. */
function trySetItemSmart(key: string, json: string, keepSessionId: string): boolean {
  if (trySetItemOnce(key, json)) return true;
  evictSimulationLocalStorageExcept(keepSessionId);
  if (trySetItemOnce(key, json)) return true;
  hardEvictAllSimulationLocalStorage();
  return trySetItemOnce(key, json);
}

/** Avoid localStorage quota: large agent traces (retrieval chunks, pipeline) + full file contents blow the ~5MB origin limit. */
export function slimPersonaResultsForStorage(
  results: Array<{
    personaId: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    content: string;
    thinking?: string;
    retrieval?: RetrievalInfo;
    validation?: ValidationInfo | null;
    pipeline_events?: AgentPipelineEvent[];
  }>
): SlimPersonaResult[] {
  return results.map((r) => ({
    personaId: r.personaId,
    name: r.name,
    description: r.description,
    avatarUrl: r.avatarUrl,
    content: r.content || '',
  }));
}

/**
 * Persist simulation persona result rows; shrinks `content` per persona until the write fits or a minimum size.
 */
export function setSimulationPersonaResultsSafe(
  sessionId: string,
  results: Array<{
    personaId: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    content: string;
    thinking?: string;
    retrieval?: RetrievalInfo;
    validation?: ValidationInfo | null;
    pipeline_events?: AgentPipelineEvent[];
  }>
): void {
  const key = `simulationPersonaResults_${sessionId}`;
  const base = slimPersonaResultsForStorage(results);
  const suffix = '\n\n[…content truncated to fit browser storage]';
  let maxContent = 450_000;

  for (let attempt = 0; attempt < 8; attempt++) {
    const rows: SlimPersonaResult[] = base.map((r) => {
      const c = r.content;
      if (c.length <= maxContent) {
        return { ...r, _storageTruncated: false };
      }
      return {
        ...r,
        content: c.slice(0, maxContent) + suffix,
        _storageTruncated: true,
      };
    });
    const json = JSON.stringify(rows);
    if (trySetItemSmart(key, json, sessionId)) return;
    maxContent = Math.floor(maxContent / 2);
    if (maxContent < 8_000) {
      const tiny = JSON.stringify(
        rows.map((r) => ({
          ...r,
          content: (r.content || '').slice(0, 4_000) + suffix,
          _storageTruncated: true,
        }))
      );
      if (trySetItemSmart(key, tiny, sessionId)) return;
      console.warn('[localStorage] Could not store simulationPersonaResults even after eviction + truncation; skipping.');
      return;
    }
  }
}

/** Cache persona for session without embedding file contents (avoids multi‑MB blob). */
export function slimPersonaForSessionCache(p: Persona): Persona {
  return { ...p, files: [] };
}

export function setSimulationPersonaCacheSafe(sessionId: string, persona: Persona): void {
  const key = `simulationPersona_${sessionId}`;
  const json = JSON.stringify(slimPersonaForSessionCache(persona));
  if (trySetItemSmart(key, json, sessionId)) return;
  const minimal: Persona = {
    id: persona.id,
    name: persona.name,
    type: persona.type,
    description: persona.description,
    metadata: {},
    files: [],
    avatarUrl: persona.avatarUrl ?? persona.avatar_url,
  };
  trySetItemSmart(key, JSON.stringify(minimal), sessionId);
}

export function setSimulationMessagesSafe(sessionId: string, messages: unknown[]): void {
  const key = `simulationMessages_${sessionId}`;
  let maxMessageChars = 120_000;
  for (let round = 0; round < 6; round++) {
    const trimmed = messages.map((m: any) => {
      const c = typeof m?.content === 'string' ? m.content : '';
      if (c.length <= maxMessageChars) return m;
      return {
        ...m,
        content: c.slice(0, maxMessageChars) + '\n\n[…truncated for storage]',
        _contentTruncated: true,
      };
    });
    const json = JSON.stringify(trimmed);
    if (trySetItemSmart(key, json, sessionId)) return;
    maxMessageChars = Math.floor(maxMessageChars / 2);
  }
  console.warn('[localStorage] Could not store simulation messages; session still works in memory.');
}

export function setSimulationPersonasListSafe(sessionId: string, personas: Persona[]): void {
  const key = `simulationPersonas_${sessionId}`;
  const light = personas.map(slimPersonaForSessionCache);
  if (trySetItemSmart(key, JSON.stringify(light), sessionId)) return;
  const tiny = light.map((p) => ({ id: p.id, name: p.name, type: p.type, description: p.description, metadata: {} }));
  trySetItemSmart(key, JSON.stringify(tiny), sessionId);
}

/** Shorten survey questions so survey JSON fits under quota after eviction. */
export function slimSurveyQuestionsForStorage(qs: SurveyQuestion[]): SurveyQuestion[] {
  return qs.map((q) => ({
    type: q.type,
    question: (q.question || '').slice(0, 8_000),
    options:
      q.type === 'multiple_choice' && Array.isArray(q.options)
        ? q.options.slice(0, 40).map((o) => (o || '').slice(0, 500))
        : undefined,
  }));
}

export function setSimulationSurveyDataSafe(
  sessionId: string,
  data: { questions: SurveyQuestion[]; answers?: Record<number, string>; respondentName?: string }
): void {
  const key = `simulationSurveyData_${sessionId}`;
  const slim = {
    ...data,
    questions: slimSurveyQuestionsForStorage(data.questions || []),
  };
  trySetItemSmart(key, JSON.stringify(slim), sessionId);
}

export function setJsonItemSafe(key: string, data: unknown): void {
  const sid = sessionIdFromSimulationStorageKey(key);
  const json = JSON.stringify(data);
  if (sid) {
    trySetItemSmart(key, json, sid);
    return;
  }
  try {
    localStorage.setItem(key, json);
  } catch (e) {
    console.warn(`[localStorage] Could not set ${key}:`, e);
  }
}

export function setStorageItemSafe(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    const isQuota =
      (e instanceof DOMException && (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)) ||
      (e as Error)?.name === 'QuotaExceededError';
    if (isQuota) {
      hardEvictAllSimulationLocalStorage();
      try {
        localStorage.setItem(key, value);
      } catch (e2) {
        console.warn(`[localStorage] Could not set ${key} after eviction:`, e2);
      }
    } else {
      console.warn(`[localStorage] Could not set ${key}:`, e);
    }
  }
}
