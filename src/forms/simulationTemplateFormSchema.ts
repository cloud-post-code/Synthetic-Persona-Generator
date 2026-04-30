import type { FormSchema } from './types.js';

/**
 * Stable voice IDs for the simulation template editor (create + edit).
 * Persists to the `simulations` table; system_prompt may also be reviewed before save.
 */
export const simulationTemplateFormSchema: FormSchema = {
  formKey: 'simulations.template',
  page: '/simulations',
  title: 'Simulation template editor',
  purpose:
    'Create or edit a simulation template. Type and inputs control how the simulation runs.',
  persistsTo: ['simulations'],
  submitTargetId: 'simulations.template.save',
  fields: [
    {
      key: 'simulation_type',
      label: 'Simulation type',
      type: 'select',
      dbColumn: 'simulation_type',
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
    {
      key: 'mic_toggle',
      label: 'Voice describe simulation',
      type: 'button',
      action: 'click',
    },
    {
      key: 'generate',
      label: 'Build simulation from description',
      type: 'button',
      action: 'click',
    },
    {
      key: 'continue_to_form',
      label: 'Continue to template details',
      type: 'button',
      action: 'click',
    },
    { key: 'title', label: 'Title', type: 'text', dbColumn: 'title', required: true },
    {
      key: 'description',
      label: 'What is this simulation about?',
      type: 'textarea',
      dbColumn: 'description',
      required: true,
    },
    {
      key: 'allowed_persona_types',
      label: 'Allowed persona types',
      type: 'checkbox',
      dbColumn: 'allowed_persona_types',
      options: [
        { value: 'synthetic_user', label: 'Synthetic User' },
        { value: 'advisor', label: 'Advisor' },
      ],
    },
    {
      key: 'persona_count_min',
      label: 'Minimum personas',
      type: 'select',
      dbColumn: 'persona_count_min',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` })),
    },
    {
      key: 'persona_count_max',
      label: 'Maximum personas',
      type: 'select',
      dbColumn: 'persona_count_max',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` })),
    },
    {
      key: 'visibility',
      label: 'Template visibility',
      type: 'radio',
      dbColumn: 'visibility',
      options: [
        { value: 'private', label: 'Private' },
        { value: 'public', label: 'Public' },
      ],
    },
    { key: 'save', label: 'Save simulation template', type: 'button', action: 'click' },
    { key: 'cancel', label: 'Cancel', type: 'button', action: 'click' },
    { key: 'review_back', label: 'Back to form from review', type: 'button', action: 'click' },
    { key: 'review_save', label: 'Save reviewed system prompt', type: 'button', action: 'click' },
    {
      key: 'system_prompt',
      label: 'System prompt (review)',
      type: 'textarea',
      dbColumn: 'system_prompt',
    },
  ],
};
