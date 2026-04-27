import type { Persona } from '../models/types.js';
import type { AgentPipelineEvent, RetrievalInfo, ValidationInfo } from '../services/agentApi.js';

export type SlimPersonaResult = {
  personaId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  content: string;
  _storageTruncated?: boolean;
};

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

function trySetItem(key: string, json: string): boolean {
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
    if (trySetItem(key, json)) return;
    maxContent = Math.floor(maxContent / 2);
    if (maxContent < 8_000) {
      if (trySetItem(
        key,
        JSON.stringify(
          rows.map((r) => ({
            ...r,
            content: (r.content || '').slice(0, 4_000) + suffix,
            _storageTruncated: true,
          }))
        )
      )) {
        return;
      }
      console.warn('[localStorage] Could not store simulationPersonaResults even after heavy truncation; skipping.');
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
  if (!trySetItem(key, json)) {
    const minimal: Persona = {
      id: persona.id,
      name: persona.name,
      type: persona.type,
      description: persona.description,
      metadata: {},
      files: [],
      avatarUrl: persona.avatarUrl ?? persona.avatar_url,
    };
    trySetItem(key, JSON.stringify(minimal));
  }
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
    if (trySetItem(key, json)) return;
    maxMessageChars = Math.floor(maxMessageChars / 2);
  }
  console.warn('[localStorage] Could not store simulation messages; session still works in memory.');
}

export function setSimulationPersonasListSafe(sessionId: string, personas: Persona[]): void {
  const key = `simulationPersonas_${sessionId}`;
  const light = personas.map(slimPersonaForSessionCache);
  if (trySetItem(key, JSON.stringify(light))) return;
  if (trySetItem(key, JSON.stringify(light.map((p) => ({ id: p.id, name: p.name, type: p.type, description: p.description, metadata: {} }))))) {
    return;
  }
  console.warn('[localStorage] Could not store simulationPersonas list.');
}

export function setJsonItemSafe(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[localStorage] Could not set ${key}:`, e);
  }
}
