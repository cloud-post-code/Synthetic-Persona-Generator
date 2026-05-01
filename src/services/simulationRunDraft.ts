import type { Persona } from '../models/types.js';
import type { SimulationInputField, SimulationTemplate } from './simulationTemplateApi.js';

export type SimulationRunDraftContextTemplate = Pick<
  SimulationTemplate,
  | 'id'
  | 'title'
  | 'description'
  | 'simulation_type'
  | 'persona_count_min'
  | 'persona_count_max'
  | 'allowed_persona_types'
  | 'required_input_fields'
>;

export type SimulationRunDraftContextPersona = Pick<Persona, 'id' | 'name' | 'type' | 'description'>;

export type SimulationRunDraftContext = {
  templates: SimulationRunDraftContextTemplate[];
  personas: SimulationRunDraftContextPersona[];
  hasSavedBusinessProfile: boolean;
};

export type SimulationRunDraft = {
  /** Resolved template id from context list, or null if no match */
  template_id: string | null;
  persona_ids: string[];
  /** Runner text / multiple_choice values keyed by required_input_fields[].name */
  input_values: Record<string, string>;
  routing_rationale: string;
  /** Human-readable notes (e.g. image fields need manual upload) */
  notes: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function scoreTitleMatch(query: string, title: string, description?: string): number {
  const q = norm(query);
  if (!q) return 0;
  const t = norm(title);
  const d = norm(description || '');
  if (t === q) return 100;
  if (t.includes(q)) return 80;
  if (q.includes(t) && t.length >= 4) return 70;
  if (d.includes(q)) return 50;
  const qw = q.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;
  for (const w of qw) {
    if (t.includes(w)) score += 15;
    if (d.includes(w)) score += 8;
  }
  return score;
}

function resolveTemplateId(
  rawId: unknown,
  titleHint: unknown,
  templates: SimulationRunDraftContextTemplate[]
): string | null {
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  if (id && templates.some((t) => t.id === id)) return id;

  const hintRaw = titleHint ?? (rawId && typeof rawId === 'string' && !templates.some((t) => t.id === id) ? rawId : '');
  const hint = typeof hintRaw === 'string' ? hintRaw.trim() : '';
  if (!hint || templates.length === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const t of templates) {
    const sc = scoreTitleMatch(hint, t.title, t.description);
    if (!best || sc > best.score) best = { id: t.id, score: sc };
  }
  if (best && best.score >= 20) return best.id;
  return null;
}

function personaAllowedForTemplate(p: SimulationRunDraftContextPersona, tpl: SimulationRunDraftContextTemplate): boolean {
  const allowed = tpl.allowed_persona_types;
  if (!allowed || allowed.length === 0) return true;
  const ty = (p.type || '').trim();
  return allowed.some((a) => a === ty);
}

function clampPersonaCount(ids: string[], min: number, max: number): string[] {
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= max) break;
  }
  while (uniq.length < min && uniq.length > 0) {
    /* cannot pad without duplicates — caller may need more personas */
    break;
  }
  return uniq.slice(0, max);
}

function str(v: unknown, max = 100000): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Normalize Gemini output against live templates and personas.
 */
export function sanitizeSimulationRunDraft(
  raw: unknown,
  ctx: SimulationRunDraftContext
): SimulationRunDraft {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const routing_rationale =
    str(r.routing_rationale, 4000) || 'Matched your description to a template and inputs where possible.';
  const notes: string[] = [];

  const template_id = resolveTemplateId(r.template_id, r.template_title_hint ?? r.template_title_match, ctx.templates);
  if (!template_id) {
    notes.push('No matching simulation template—try naming the template or picking one from the list.');
    return {
      template_id: null,
      persona_ids: [],
      input_values: {},
      routing_rationale,
      notes,
    };
  }

  const tpl = ctx.templates.find((t) => t.id === template_id)!;
  const minP = tpl.persona_count_min ?? 1;
  const maxP = tpl.persona_count_max ?? 1;

  const rawIds = Array.isArray(r.persona_ids) ? r.persona_ids : [];
  const requestedIds = rawIds.map((x) => str(x, 200)).filter(Boolean);

  const validPersonas = ctx.personas.filter((p) => personaAllowedForTemplate(p, tpl));
  const validIdSet = new Set(validPersonas.map((p) => p.id));

  let persona_ids = requestedIds.filter((id) => validIdSet.has(id));
  if (persona_ids.length === 0 && validPersonas.length > 0) {
    persona_ids = validPersonas.slice(0, maxP).map((p) => p.id);
    notes.push('Adjusted persona selection to personas allowed for this template.');
  }

  persona_ids = clampPersonaCount(persona_ids, minP, maxP);

  if (persona_ids.length < minP) {
    notes.push(
      `This simulation needs at least ${minP} persona(s); only ${persona_ids.length} matched. Select more manually.`
    );
  }

  const input_values: Record<string, string> = {};
  const rawValues = r.input_values && typeof r.input_values === 'object' ? (r.input_values as Record<string, unknown>) : {};

  for (const field of tpl.required_input_fields || []) {
    const { name, type, required: _req, options } = field;
    if (type === 'image' || type === 'pdf' || type === 'table') {
      notes.push(`"${name}" (${type}) needs a manual upload.`);
      continue;
    }
    if (type === 'business_profile' || name === 'businessProfile') {
      if (!ctx.hasSavedBusinessProfile) {
        notes.push('This simulation uses your business profile—save one on Business Profile if required.');
      }
      continue;
    }
    if (type === 'survey_questions') {
      notes.push(`"${name}" (survey questions) must be filled manually in the form.`);
      continue;
    }
    const v = rawValues[name];
    if (v == null || String(v).trim() === '') continue;
    let s = str(v);
    if (type === 'multiple_choice' && options?.length) {
      const exact = options.find((o) => norm(o) === norm(s));
      if (exact) s = exact;
      else {
        const partial = options.find((o) => norm(s).includes(norm(o)) || norm(o).includes(norm(s)));
        if (partial) s = partial;
        else {
          notes.push(`"${name}": value not in allowed options—skipped.`);
          continue;
        }
      }
    }
    input_values[name] = s;
  }

  return {
    template_id,
    persona_ids,
    input_values,
    routing_rationale,
    notes,
  };
}
