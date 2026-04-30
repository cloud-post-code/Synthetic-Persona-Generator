import type { FormSchema } from './types.js';

/** Picker on /build before any wizard opens. */
export const buildPersonaPickerSchema: FormSchema = {
  formKey: 'build.persona.picker',
  page: '/build',
  title: 'Build persona — pick mode',
  purpose: 'Choose between Synthetic User and Advisor builders.',
  fields: [
    { key: 'choose_synthetic', label: 'Open Synthetic User builder', type: 'button', action: 'click' },
    { key: 'choose_advisor', label: 'Open Advisor builder', type: 'button', action: 'click' },
    { key: 'back', label: 'Back to selection', type: 'button', action: 'click' },
  ],
};

/** Synthetic User wizard, problem/solution mode. Persists indirectly via personaApi.create. */
export const buildSyntheticProblemSolutionSchema: FormSchema = {
  formKey: 'build.persona.problem_solution',
  page: '/build',
  title: 'Synthetic User — problem / solution',
  purpose:
    'Generate synthetic user personas from a problem/solution prompt. Calls personaApi.create per persona.',
  persistsTo: ['personas', 'persona_files'],
  submitTargetId: 'build.persona.problem_solution.submit',
  fields: [
    { key: 'problem', label: 'Problem or question', type: 'textarea', required: true },
    { key: 'solution', label: 'Solution or hypothesis', type: 'textarea', required: true },
    { key: 'differentiation', label: 'Differentiation', type: 'textarea', required: true },
    { key: 'alternatives', label: 'Existing alternatives', type: 'textarea', required: true },
    {
      key: 'context',
      label: 'Context (B2B or B2C)',
      type: 'select',
      options: [
        { value: 'B2B', label: 'B2B' },
        { value: 'B2C', label: 'B2C' },
      ],
    },
    {
      key: 'count',
      label: 'Number of personas to generate',
      type: 'select',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` })),
    },
    { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
  ],
};

export const buildSyntheticSupportingDocsSchema: FormSchema = {
  formKey: 'build.persona.supporting_docs',
  page: '/build',
  title: 'Synthetic User — supporting docs',
  purpose: 'Generate synthetic user personas from an uploaded business document.',
  persistsTo: ['personas', 'persona_files'],
  submitTargetId: 'build.persona.supporting_docs.submit',
  fields: [
    { key: 'file', label: 'Supporting docs file', type: 'button', action: 'click' },
    {
      key: 'count',
      label: 'Number of personas to generate',
      type: 'select',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` })),
    },
    { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
  ],
};

export const buildSyntheticBusinessProfileSchema: FormSchema = {
  formKey: 'build.persona.business_profile',
  page: '/build',
  title: 'Synthetic User — from business profile',
  purpose:
    'Generate synthetic user personas using the runner saved business profile. Optional specific user type.',
  persistsTo: ['personas', 'persona_files'],
  submitTargetId: 'build.persona.business_profile.submit',
  fields: [
    {
      key: 'specific_user_type',
      label: 'Specific type of user (optional)',
      type: 'text',
      examples: ['enterprise buyers', 'SMB decision-makers', 'consumers in healthcare'],
    },
    {
      key: 'count',
      label: 'Number of personas to generate',
      type: 'select',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` })),
    },
    { key: 'submit', label: 'Submit Blueprint', type: 'button', action: 'click' },
  ],
};

export const buildAdvisorLinkedinSchema: FormSchema = {
  formKey: 'build.persona.advisor_linkedin',
  page: '/build',
  title: 'Advisor — LinkedIn paste',
  purpose: 'Build an advisor persona from pasted LinkedIn / resume text and optional CV file.',
  persistsTo: ['personas', 'persona_files'],
  submitTargetId: 'build.persona.advisor_linkedin.submit',
  fields: [
    {
      key: 'linkedin_text',
      label: 'LinkedIn profile text',
      type: 'textarea',
      required: true,
      description: 'Pasted profile or resume text — never a URL.',
    },
    { key: 'other_docs_file', label: 'Other docs (CV/portfolio) file', type: 'button', action: 'click' },
    { key: 'submit', label: 'Submit for Advisor Profiling', type: 'button', action: 'click' },
  ],
};

export const buildAdvisorPdfSchema: FormSchema = {
  formKey: 'build.persona.advisor_pdf',
  page: '/build',
  title: 'Advisor — upload document',
  purpose: 'Build an advisor persona by uploading a PDF or document.',
  persistsTo: ['personas', 'persona_files'],
  submitTargetId: 'build.persona.advisor_pdf.submit',
  fields: [
    { key: 'file', label: 'Expert source document', type: 'button', action: 'click' },
    { key: 'submit', label: 'Submit for Advisor Profiling', type: 'button', action: 'click' },
  ],
};

/** Visibility step that appears after generation completes (both flows). */
export const buildPersonaVisibilitySchema: FormSchema = {
  formKey: 'build.persona.visibility',
  page: '/build',
  title: 'Build persona — visibility',
  purpose: 'Final step: choose private vs public, then save the generated personas.',
  persistsTo: ['personas'],
  submitTargetId: 'build.save',
  fields: [
    {
      key: 'visibility',
      label: 'Persona visibility',
      type: 'radio',
      options: [
        { value: 'private', label: 'Private' },
        { value: 'public', label: 'Public' },
      ],
    },
    { key: 'save', label: 'Save and go to My Personas', type: 'button', action: 'click' },
  ],
};

export const buildPersonaSchemas: FormSchema[] = [
  buildPersonaPickerSchema,
  buildSyntheticProblemSolutionSchema,
  buildSyntheticSupportingDocsSchema,
  buildSyntheticBusinessProfileSchema,
  buildAdvisorLinkedinSchema,
  buildAdvisorPdfSchema,
  buildPersonaVisibilitySchema,
];
