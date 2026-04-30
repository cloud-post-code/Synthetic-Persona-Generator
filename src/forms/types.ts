/**
 * Shared types for form schemas. A FormSchema is the single source of truth for
 * a form's field labels, types, and DB columns. It drives:
 *  1. Stable `useVoiceTarget` IDs through `useFormSchema`.
 *  2. The UI semantics RAG corpus consumed by the navigator agent.
 *
 * Backend mirror lives in `backend/src/voice/forms/*` — keep in sync.
 */

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'url'
  | 'password'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'tab'
  | 'button';

export type FormFieldAction = 'fill' | 'click' | 'focus';

export type FormFieldDef = {
  /** Stable key, lowercase snake_case. Used to build `pageDomain.formKey.key`. */
  key: string;
  /** Human label spoken by the agent and shown to users. */
  label: string;
  type: FormFieldType;
  /** Voice action; defaults derived from `type`. */
  action?: FormFieldAction;
  /** When true the field cannot be skipped to complete the form. */
  required?: boolean;
  /** Backend column / API key this field maps to (helps the planner reason about live DB shape). */
  dbColumn?: string;
  /** Allowed values for select/radio fields (label + machine value). */
  options?: { value: string; label: string }[];
  /** Multi-line free text for the planner: when to use, examples, gotchas. */
  description?: string;
  /** Examples the planner can quote when filling. */
  examples?: string[];
  /** Minimum / maximum hints surfaced in the corpus (length, value, etc.). */
  hints?: string[];
};

export type FormSchema = {
  /** Stable form key, e.g. `business.profile`, `build.persona.problem_solution`. */
  formKey: string;
  /** Page route this form lives on (used by the agent to plan navigation first). */
  page: string;
  /** Optional query string (matched as a substring against current location.search). */
  pageQuery?: Record<string, string>;
  /** Title shown in corpus and dock. */
  title: string;
  /** Short purpose/use-case description for the planner. */
  purpose: string;
  /** Backend table(s) this form persists to, for the corpus. */
  persistsTo?: string[];
  /** Optional submit/save target id (typically `${formKey}.save`). */
  submitTargetId?: string;
  fields: FormFieldDef[];
};

export function defaultActionForType(type: FormFieldType): FormFieldAction {
  switch (type) {
    case 'button':
    case 'tab':
    case 'checkbox':
    case 'radio':
      return 'click';
    case 'select':
      return 'fill';
    default:
      return 'fill';
  }
}

/** Build the canonical voice target id for a field. */
export function fieldTargetId(formKey: string, fieldKey: string): string {
  return `${formKey}.${fieldKey}`;
}
