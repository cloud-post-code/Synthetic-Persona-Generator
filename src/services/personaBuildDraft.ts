export type PersonaTypeChoice = 'synthetic_user' | 'advisor';

export type SyntheticMethod = 'problem_solution' | 'supporting_docs' | 'business_profile';

export type AdvisorSource = 'linkedin' | 'pdf' | 'free_text';

export type PersonaBuildDraft = {
  persona_type: PersonaTypeChoice;
  /** Short explanation for the UI */
  routing_rationale: string;
  synthetic_method?: SyntheticMethod;
  problem?: string;
  solution?: string;
  differentiation?: string;
  alternatives?: string;
  context?: 'B2B' | 'B2C';
  persona_count?: number;
  /** When synthetic_method is supporting_docs: text to put in the supporting-docs field */
  supporting_docs_content?: string;
  specific_user_type?: string;
  advisor_source?: AdvisorSource;
  /** LinkedIn-style paste, free-text expert notes, or profile material */
  advisor_source_text?: string;
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function str(v: unknown, max = 50000): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function sanitizePersonaBuildDraft(
  raw: unknown,
  opts?: { forcePersonaType?: PersonaTypeChoice }
): PersonaBuildDraft {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let persona_type: PersonaTypeChoice =
    r.persona_type === 'advisor' || r.persona_type === 'synthetic_user' ? r.persona_type : 'synthetic_user';
  if (opts?.forcePersonaType) persona_type = opts.forcePersonaType;

  const routing_rationale = str(r.routing_rationale, 2000) || 'Chose the closest builder path from your description.';

  const sm = r.synthetic_method;
  const synthetic_method: SyntheticMethod | undefined =
    sm === 'supporting_docs' || sm === 'business_profile' || sm === 'problem_solution' ? sm : undefined;

  const advisor_src = r.advisor_source;
  const advisor_source: AdvisorSource | undefined =
    advisor_src === 'linkedin' || advisor_src === 'pdf' || advisor_src === 'free_text' ? advisor_src : undefined;

  const context = r.context === 'B2C' ? 'B2C' : r.context === 'B2B' ? 'B2B' : undefined;

  return {
    persona_type,
    routing_rationale,
    synthetic_method: persona_type === 'synthetic_user' ? synthetic_method ?? 'problem_solution' : undefined,
    problem: str(r.problem),
    solution: str(r.solution),
    differentiation: str(r.differentiation),
    alternatives: str(r.alternatives),
    context,
    persona_count: clampInt(r.persona_count, 1, 5, 1),
    supporting_docs_content: str(r.supporting_docs_content, 100000),
    specific_user_type: str(r.specific_user_type, 2000),
    advisor_source: persona_type === 'advisor' ? advisor_source ?? 'free_text' : undefined,
    advisor_source_text: str(r.advisor_source_text, 100000),
  };
}
