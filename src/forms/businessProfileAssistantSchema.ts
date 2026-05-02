import type { FormSchema } from './types.js';

/** Voice + LLM assistant strip on /business-profile (mic, sparse multi-section fill). */
export const businessProfileAssistantSchema: FormSchema = {
  formKey: 'business.profile.assistant',
  page: '/business-profile',
  title: 'Business profile — voice assistant',
  purpose:
    'Voice-first: tap the mic to describe your business, tap again to map speech into Business Profile sections (sparse keys); staged UI apply.',
  fields: [
    {
      key: 'mic_toggle',
      label: 'Tap to speak your business; tap again to build from what you said',
      type: 'button',
      action: 'click',
    },
  ],
};
