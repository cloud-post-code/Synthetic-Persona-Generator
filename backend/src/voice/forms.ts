/**
 * Backend mirror of `src/forms/*` — keep field keys, labels, and ids in sync.
 * Used by `generateUiSemantics` to emit the RAG corpus that grounds the planner.
 */

import {
  BUSINESS_PROFILE_SPEC,
  businessProfileAnswerKey,
} from '../constants/businessProfileSpec.js';

export type BackendFormFieldType =
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

export type BackendFormFieldDef = {
  key: string;
  label: string;
  type: BackendFormFieldType;
  action?: 'click' | 'fill' | 'focus';
  required?: boolean;
  dbColumn?: string;
  options?: { value: string; label: string }[];
  description?: string;
  examples?: string[];
};

export type BackendFormSchema = {
  formKey: string;
  page: string;
  pageQuery?: Record<string, string>;
  title: string;
  purpose: string;
  persistsTo?: string[];
  submitTargetId?: string;
  fields: BackendFormFieldDef[];
};

export function fieldId(formKey: string, key: string): string {
  return `${formKey}.${key}`;
}

const yesNoCount: { value: string; label: string }[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: `${n}`,
}));

function businessProfileBackendFormFields(): BackendFormFieldDef[] {
  const fields: BackendFormFieldDef[] = [];
  for (const sec of BUSINESS_PROFILE_SPEC) {
    for (const fw of sec.frameworks) {
      for (const q of fw.questions) {
        const key = businessProfileAnswerKey(sec.key, fw.key, q.key);
        fields.push({
          key,
          dbColumn: key,
          label: q.label,
          type: 'textarea',
          description: `${sec.title} — ${fw.title}`,
        });
      }
    }
  }
  fields.push({ key: 'save', label: 'Save business profile (sync)', type: 'button', action: 'click' });
  return fields;
}

export const ALL_FORMS: BackendFormSchema[] = [
  {
    formKey: 'build.persona.assistant',
    page: '/build',
    title: 'Build persona — voice assistant',
    purpose:
      'Voice and text describe; Build it for me routes to Synthetic user or Advisor and fills fields.',
    fields: [
      { key: 'describe', label: 'Describe your persona', type: 'textarea' },
      { key: 'mic_toggle', label: 'Voice describe persona', type: 'button', action: 'click' },
      { key: 'generate', label: 'Build persona form from description', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'login',
    page: '/login',
    title: 'Sign in',
    purpose: 'Authenticate the user. Issues a JWT and redirects to the dashboard.',
    persistsTo: ['users'],
    submitTargetId: 'login.submit',
    fields: [
      { key: 'username', dbColumn: 'username', label: 'Username or email', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'submit', label: 'Sign in', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'business.profile',
    page: '/business-profile',
    title: 'Business profile',
    purpose:
      'Structured Business Profile Builder (disciplined entrepreneurship). Answers auto-save to business_profiles.answers (JSON).',
    persistsTo: ['business_profiles'],
    submitTargetId: 'business.profile.save',
    fields: businessProfileBackendFormFields(),
  },
  {
    formKey: 'business.profile.assistant',
    page: '/business-profile',
    title: 'Business profile — voice assistant',
    purpose:
      'Natural-language and voice input to map descriptions across Business Profile sections (sparse keys); staged UI apply.',
    fields: [
      {
        key: 'describe',
        label: 'Describe your business',
        type: 'textarea',
        description:
          'Type or dictate; Build it for me routes content to the relevant profile sections and fields.',
      },
      { key: 'mic_toggle', label: 'Voice describe business profile', type: 'button', action: 'click' },
      { key: 'generate', label: 'Fill profile from description', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.picker',
    page: '/build',
    title: 'Build persona — pick mode',
    purpose: 'Choose between Synthetic User and Advisor builders.',
    fields: [
      { key: 'choose_synthetic', label: 'Open Synthetic User builder', type: 'button', action: 'click' },
      { key: 'choose_advisor', label: 'Open Advisor builder', type: 'button', action: 'click' },
      { key: 'back', label: 'Back to selection', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.problem_solution',
    page: '/build',
    title: 'Synthetic User — problem / solution',
    purpose: 'Generate synthetic user personas from a problem/solution prompt.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.problem_solution.submit',
    fields: [
      { key: 'problem', label: 'Problem or question', type: 'textarea', required: true },
      { key: 'solution', label: 'Solution or hypothesis', type: 'textarea', required: true },
      { key: 'differentiation', label: 'Differentiation', type: 'textarea', required: true },
      { key: 'alternatives', label: 'Existing alternatives', type: 'textarea', required: true },
      { key: 'context', label: 'Context (B2B or B2C)', type: 'select', options: [{ value: 'B2B', label: 'B2B' }, { value: 'B2C', label: 'B2C' }] },
      { key: 'count', label: 'Number of personas to generate', type: 'select', options: yesNoCount },
      { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.supporting_docs',
    page: '/build',
    title: 'Synthetic User — supporting docs',
    purpose: 'Generate synthetic user personas from an uploaded business document.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.supporting_docs.submit',
    fields: [
      { key: 'file', label: 'Supporting docs file', type: 'button', action: 'click' },
      { key: 'count', label: 'Number of personas to generate', type: 'select', options: yesNoCount },
      { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.business_profile',
    page: '/build',
    title: 'Synthetic User — from business profile',
    purpose: 'Generate synthetic user personas using the runner saved business profile.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.business_profile.submit',
    fields: [
      { key: 'specific_user_type', label: 'Specific type of user (optional)', type: 'text' },
      { key: 'count', label: 'Number of personas to generate', type: 'select', options: yesNoCount },
      { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.advisor_linkedin',
    page: '/build',
    title: 'Advisor — LinkedIn paste',
    purpose: 'Build an advisor persona from pasted LinkedIn or resume text.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.advisor_linkedin.submit',
    fields: [
      { key: 'linkedin_text', label: 'LinkedIn profile text', type: 'textarea', required: true },
      { key: 'other_docs_file', label: 'Other docs (CV/portfolio) file', type: 'button', action: 'click' },
      { key: 'submit', label: 'Submit for Advisor Profiling', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.advisor_pdf',
    page: '/build',
    title: 'Advisor — upload document',
    purpose: 'Build an advisor persona from a PDF or document.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.advisor_pdf.submit',
    fields: [
      { key: 'file', label: 'Expert source document', type: 'button', action: 'click' },
      { key: 'submit', label: 'Submit for Advisor Profiling', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.advisor_free_text',
    page: '/build',
    title: 'Advisor — describe expert (text)',
    purpose:
      'Build an advisor from freeform text; optional Improve with LLM normalizes notes into profile-style source, then the same pipeline as LinkedIn paste.',
    persistsTo: ['personas', 'persona_files'],
    submitTargetId: 'build.persona.advisor_free_text.submit',
    fields: [
      { key: 'free_text', label: 'Expert description (notes or bio)', type: 'textarea', required: true },
      { key: 'improve_llm', label: 'Improve with LLM', type: 'button', action: 'click' },
      { key: 'other_docs_file', label: 'Other docs (CV/portfolio) file', type: 'button', action: 'click' },
      { key: 'submit', label: 'Submit for Advisor Profiling', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'build.persona.visibility',
    page: '/build',
    title: 'Build persona — visibility',
    purpose: 'Choose private or public for the just-generated personas, then save.',
    persistsTo: ['personas'],
    submitTargetId: 'build.save',
    fields: [
      { key: 'visibility', label: 'Persona visibility', type: 'radio', options: [{ value: 'private', label: 'Private' }, { value: 'public', label: 'Public' }] },
      { key: 'save', label: 'Save and go to My Personas', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'simulations.template',
    page: '/simulations',
    title: 'Simulation template editor',
    purpose: 'Create or edit a simulation template that drives how a simulation runs.',
    persistsTo: ['simulations'],
    submitTargetId: 'simulations.template.save',
    fields: [
      {
        key: 'simulation_type', label: 'Simulation type', type: 'select', dbColumn: 'simulation_type',
        options: [
          { value: 'report', label: 'Report' },
          { value: 'persuasion_simulation', label: 'Persuasion Simulation' },
          { value: 'response_simulation', label: 'Response Simulation' },
          { value: 'survey', label: 'Survey' },
          { value: 'persona_conversation', label: 'Persona v Persona Conversation' },
          { value: 'idea_generation', label: 'Idea Generation' },
        ],
      },
      {
        key: 'describe',
        label: 'Describe your simulation',
        type: 'textarea',
        description:
          'Natural-language brief for the AI builder: type or dictate what you want, then use Build it for me to fill the whole template.',
      },
      { key: 'mic_toggle', label: 'Voice describe simulation', type: 'button', action: 'click' },
      { key: 'generate', label: 'Build simulation from description', type: 'button', action: 'click' },
      { key: 'continue_to_form', label: 'Continue to template details', type: 'button', action: 'click' },
      { key: 'title', label: 'Title', type: 'text', dbColumn: 'title', required: true },
      { key: 'description', label: 'What is this simulation about?', type: 'textarea', dbColumn: 'description', required: true },
      {
        key: 'allowed_persona_types', label: 'Allowed persona types', type: 'checkbox', dbColumn: 'allowed_persona_types',
        options: [
          { value: 'synthetic_user', label: 'Synthetic User' },
          { value: 'advisor', label: 'Advisor' },
        ],
      },
      { key: 'persona_count_min', label: 'Minimum personas', type: 'select', dbColumn: 'persona_count_min', options: yesNoCount },
      { key: 'persona_count_max', label: 'Maximum personas', type: 'select', dbColumn: 'persona_count_max', options: yesNoCount },
      {
        key: 'visibility', label: 'Template visibility', type: 'radio', dbColumn: 'visibility',
        options: [
          { value: 'private', label: 'Private' },
          { value: 'public', label: 'Public' },
        ],
      },
      { key: 'save', label: 'Save simulation template', type: 'button', action: 'click' },
      { key: 'cancel', label: 'Cancel', type: 'button', action: 'click' },
      { key: 'review_back', label: 'Back to form from review', type: 'button', action: 'click' },
      { key: 'review_save', label: 'Save reviewed system prompt', type: 'button', action: 'click' },
      { key: 'system_prompt', label: 'System prompt review', type: 'textarea', dbColumn: 'system_prompt' },
    ],
  },
  {
    formKey: 'simulate.run.assistant',
    page: '/simulate',
    title: 'Run simulation — voice assistant',
    purpose:
      'Pick a template the user can access, select personas within allowed types and counts, and pre-fill runner text fields. Does not start the simulation.',
    fields: [
      {
        key: 'describe',
        label: 'Describe what you want to simulate',
        type: 'textarea',
        description: 'Build it for me fills template choice, personas, and inputs where possible.',
      },
      { key: 'mic_toggle', label: 'Voice describe simulation run', type: 'button', action: 'click' },
      { key: 'generate', label: 'Fill simulation run from description', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'settings.tabs',
    page: '/settings',
    title: 'Settings — sidebar tabs',
    purpose: 'Switch between Profile, Security, Notifications, and Data sections.',
    fields: [
      { key: 'profile', label: 'Profile tab', type: 'tab', action: 'click' },
      { key: 'security', label: 'Security tab', type: 'tab', action: 'click' },
      { key: 'notifications', label: 'Notifications tab', type: 'tab', action: 'click' },
      { key: 'data', label: 'Data tab', type: 'tab', action: 'click' },
      { key: 'sign_out', label: 'Sign out', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'settings.profile',
    page: '/settings',
    title: 'Settings — profile',
    purpose: 'Edit account-level profile fields and voice agent toggles.',
    persistsTo: ['users'],
    submitTargetId: 'settings.profile.save',
    fields: [
      { key: 'display_name', label: 'Display name', type: 'text' },
      { key: 'username', label: 'Username', type: 'text', dbColumn: 'username' },
      { key: 'email', label: 'Email', type: 'email', dbColumn: 'email' },
      { key: 'bio', label: 'Bio', type: 'textarea' },
      { key: 'voice_agent_enabled', label: 'Enable voice agent', type: 'checkbox' },
      { key: 'voice_tts_enabled', label: 'Speak confirmations', type: 'checkbox' },
      { key: 'save', label: 'Save profile changes', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'chat.composer',
    page: '/chat',
    title: 'Chat — composer',
    purpose: 'Send messages to a persona in an open chat thread.',
    persistsTo: ['messages'],
    submitTargetId: 'chat.composer.send',
    fields: [
      { key: 'message_input', label: 'Chat message', type: 'textarea' },
      { key: 'send', label: 'Send chat message', type: 'button', action: 'click' },
    ],
  },
  {
    formKey: 'focus_groups.create',
    page: '/gallery',
    pageQuery: { tab: 'focusGroups' },
    title: 'Focus group — create',
    purpose: 'Create a new focus group of personas. Persists to focus_groups.',
    persistsTo: ['focus_groups'],
    submitTargetId: 'focus_groups.create.submit',
    fields: [
      { key: 'name', label: 'Focus group name', type: 'text', dbColumn: 'name', required: true },
      {
        key: 'allowed_role', label: 'Allowed persona role', type: 'select', dbColumn: 'allowed_persona_types',
        options: [
          { value: '', label: 'All personas' },
          { value: 'synthetic_user', label: 'Synthetic User' },
          { value: 'advisor', label: 'Advisor' },
        ],
      },
      { key: 'cancel', label: 'Cancel', type: 'button', action: 'click' },
      { key: 'submit', label: 'Create focus group', type: 'button', action: 'click' },
    ],
  },
];
