import type {
  CreateSimulationRequest,
  SimulationInputField,
  SimulationType,
  SurveyQuestion,
} from './simulationTemplateApi.js';
import { normalizeBusinessProfileScope } from '../constants/businessProfileSpec.js';

const SIMULATION_TYPES: SimulationType[] = [
  'report',
  'persuasion_simulation',
  'response_simulation',
  'survey',
  'persona_conversation',
  'idea_generation',
];

const ALLOWED_PERSONA_TYPES = ['synthetic_user', 'advisor'] as const;

const RUNNER_FIELD_TYPES: SimulationInputField['type'][] = [
  'text',
  'image',
  'table',
  'pdf',
  'multiple_choice',
  'business_profile',
  'survey_questions',
];

function isSimulationType(v: unknown): v is SimulationType {
  return typeof v === 'string' && (SIMULATION_TYPES as readonly string[]).includes(v);
}

function clampPersonaCount(n: unknown, fallback: number): number {
  const x = typeof n === 'number' && !Number.isNaN(n) ? Math.floor(n) : Number.parseInt(String(n), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(5, Math.max(1, x));
}

function normalizeAllowedPersonaTypes(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return ['synthetic_user'];
  const out = raw
    .map((x) => String(x).trim())
    .filter((x) => (ALLOWED_PERSONA_TYPES as readonly string[]).includes(x));
  return out.length ? out : ['synthetic_user'];
}

function normalizeInputFields(raw: unknown): SimulationInputField[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ name: 'bgInfo', type: 'text', required: false }];
  }
  const out: SimulationInputField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? '').trim();
    const typeRaw = String(o.type ?? 'text').trim();
    const type = (RUNNER_FIELD_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as SimulationInputField['type'])
      : 'text';
    const required = Boolean(o.required);
    let options = Array.isArray(o.options)
      ? (o.options as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined;
    if (type === 'multiple_choice' && (!options || options.length === 0)) {
      options = ['Option A', 'Option B'];
    }
    const field: SimulationInputField = {
      name: type === 'business_profile' ? 'businessProfile' : name || `field_${out.length + 1}`,
      type,
      required,
      ...(options && options.length ? { options } : {}),
    };
    out.push(field);
  }
  if (out.length === 0) {
    return [{ name: 'bgInfo', type: 'text', required: false }];
  }
  for (const f of out) {
    if (!f.name.trim()) {
      f.name = `field_${out.indexOf(f) + 1}`;
    }
  }
  return out;
}

function normalizeSurveyQuestions(raw: unknown): SurveyQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ type: 'text', question: 'What is your overall impression?' }];
  }
  const out: SurveyQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const qt = String(o.type ?? 'text');
    const type =
      qt === 'numeric' || qt === 'multiple_choice' ? (qt as SurveyQuestion['type']) : 'text';
    const question = String(o.question ?? '').trim() || 'Untitled question';
    let options = Array.isArray(o.options)
      ? (o.options as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined;
    if (type === 'multiple_choice' && (!options || options.length === 0)) {
      options = ['Yes', 'No', 'Unsure'];
    }
    out.push({ type, question, ...(options?.length ? { options } : {}) });
  }
  return out.length ? out : [{ type: 'text', question: 'What is your overall impression?' }];
}

function stripTypeSpecificConfig(
  simulationType: SimulationType,
  raw: Record<string, unknown> | undefined
): Record<string, unknown> {
  const src = raw && typeof raw === 'object' ? { ...raw } : {};
  switch (simulationType) {
    case 'report': {
      const report_structure =
        typeof src.report_structure === 'string' && src.report_structure.trim()
          ? src.report_structure.trim()
          : 'Executive Summary\nKey Findings\nRecommendations\nNext Steps';
      const next: Record<string, unknown> = { report_structure };
      if (typeof src.report_example_file_name === 'string' && src.report_example_file_name.trim()) {
        next.report_example_file_name = src.report_example_file_name.trim();
      }
      if (typeof src.report_example_content_base64 === 'string' && src.report_example_content_base64.trim()) {
        next.report_example_content_base64 = src.report_example_content_base64.trim();
      }
      return next;
    }
    case 'persuasion_simulation': {
      const decision_point =
        typeof src.decision_point === 'string' && src.decision_point.trim()
          ? src.decision_point.trim()
          : 'The user aims to persuade the persona to agree with a proposed course of action.';
      const decision_criteria =
        typeof src.decision_criteria === 'string' && src.decision_criteria.trim()
          ? src.decision_criteria.trim()
          : 'Persuasion is measured by alignment with stated goals, reduction of objections, and willingness to commit.';
      const context_label =
        typeof src.context_label === 'string' ? src.context_label : '';
      return { context_label, decision_point, decision_criteria };
    }
    case 'response_simulation': {
      const decision_typeRaw = String(src.decision_type ?? 'numeric');
      const decision_type =
        decision_typeRaw === 'action' || decision_typeRaw === 'text' ? decision_typeRaw : 'numeric';
      const next: Record<string, unknown> = { decision_type };
      if (decision_type === 'numeric') {
        const unit =
          typeof src.unit === 'string' && src.unit.trim()
            ? src.unit.trim()
            : 'minutes';
        next.unit = unit;
      }
      if (decision_type === 'action') {
        const action_options =
          typeof src.action_options === 'string' && src.action_options.trim()
            ? src.action_options.trim()
            : 'Proceed, Defer, Reject';
        next.action_options = action_options;
      }
      return next;
    }
    case 'survey': {
      const modeRaw = String(src.survey_mode ?? 'generated');
      const survey_mode = modeRaw === 'custom' ? 'custom' : 'generated';
      const next: Record<string, unknown> = { survey_mode };
      if (survey_mode === 'generated') {
        const survey_purpose =
          typeof src.survey_purpose === 'string' && src.survey_purpose.trim()
            ? src.survey_purpose.trim()
            : 'Collect structured feedback relevant to the scenario.';
        next.survey_purpose = survey_purpose;
        next.survey_questions = normalizeSurveyQuestions(src.survey_questions);
      }
      return next;
    }
    case 'persona_conversation': {
      const allowed = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50];
      let max = typeof src.max_persona_turns === 'number' ? src.max_persona_turns : Number(src.max_persona_turns);
      if (Number.isNaN(max)) max = 10;
      const closest = allowed.reduce((a, b) => (Math.abs(b - max) < Math.abs(a - max) ? b : a), 10);
      return { max_persona_turns: closest };
    }
    case 'idea_generation': {
      const allowedIdeas = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
      let num = typeof src.num_ideas === 'number' ? src.num_ideas : Number(src.num_ideas);
      if (Number.isNaN(num)) num = 5;
      const closest = allowedIdeas.reduce((a, b) => (Math.abs(b - num) < Math.abs(a - num) ? b : a), 5);
      return { num_ideas: closest };
    }
    default:
      return {};
  }
}

/**
 * Draft payload for the simulation template form (subset of CreateSimulationRequest;
 * system_prompt is optional until review step).
 */
export type SimulationDraft = Omit<CreateSimulationRequest, 'system_prompt' | 'is_active'> & {
  system_prompt?: string;
};

export function sanitizeDraft(raw: unknown): SimulationDraft {
  const o =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const simulation_type: SimulationType = isSimulationType(o.simulation_type) ? o.simulation_type : 'report';

  const title =
    typeof o.title === 'string' && o.title.trim()
      ? o.title.trim().slice(0, 500)
      : 'Untitled simulation';

  const description =
    typeof o.description === 'string' && o.description.trim()
      ? o.description.trim()
      : `Simulation: ${title}. Purpose and behavior should be refined by the author before running.`;

  const allowed_persona_types = normalizeAllowedPersonaTypes(o.allowed_persona_types);

  let persona_count_min = clampPersonaCount(o.persona_count_min, 1);
  let persona_count_max = clampPersonaCount(o.persona_count_max, simulation_type === 'persona_conversation' ? 3 : 1);
  if (simulation_type === 'persona_conversation') {
    if (persona_count_min < 2) persona_count_min = 2;
    if (persona_count_max < 2) persona_count_max = Math.max(2, persona_count_max);
  }
  if (persona_count_min > persona_count_max) {
    [persona_count_min, persona_count_max] = [persona_count_max, persona_count_min];
  }

  let type_specific_config = stripTypeSpecificConfig(
    simulation_type,
    o.type_specific_config && typeof o.type_specific_config === 'object'
      ? (o.type_specific_config as Record<string, unknown>)
      : undefined
  );

  const rawTsc =
    o.type_specific_config && typeof o.type_specific_config === 'object'
      ? (o.type_specific_config as Record<string, unknown>)
      : undefined;
  if (rawTsc && 'business_profile_scope' in rawTsc) {
    type_specific_config = {
      ...type_specific_config,
      business_profile_scope: normalizeBusinessProfileScope(rawTsc.business_profile_scope),
    };
  }

  const required_input_fields = normalizeInputFields(o.required_input_fields);

  const visibilityRaw = String(o.visibility ?? 'private').toLowerCase();
  const visibility =
    visibilityRaw === 'public' || visibilityRaw === 'global' ? 'public' : 'private';

  const icon =
    typeof o.icon === 'string' && o.icon.trim() ? o.icon.trim().slice(0, 120) : undefined;

  const draft: SimulationDraft = {
    title,
    description,
    ...(icon ? { icon } : {}),
    simulation_type,
    allowed_persona_types,
    persona_count_min,
    persona_count_max,
    type_specific_config: Object.keys(type_specific_config).length ? type_specific_config : undefined,
    required_input_fields,
    visibility: visibility as CreateSimulationRequest['visibility'],
  };

  if (typeof o.system_prompt === 'string' && o.system_prompt.trim()) {
    draft.system_prompt = o.system_prompt.trim();
  }

  return draft;
}
