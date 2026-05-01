import type { FormSchema } from './types.js';

/** Voice + LLM assistant strip on /business-profile (describe, mic, sparse multi-section fill). */
export const businessProfileAssistantSchema: FormSchema = {
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
};
