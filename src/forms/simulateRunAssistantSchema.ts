import type { FormSchema } from './types.js';

/** Voice-first assistant strip on /simulate: mic captures speech; second tap builds the run. */
export const simulateRunAssistantSchema: FormSchema = {
  formKey: 'simulate.run.assistant',
  page: '/simulate',
  title: 'Run simulation — voice assistant',
  purpose:
    'Voice-first: tap the mic to describe the run, tap again to pick an accessible template, personas, and pre-fill runner text fields. Does not start the run—user reviews then Configure test / Start simulation.',
  fields: [
    {
      key: 'mic_toggle',
      label: 'Tap to speak your run; tap again to build from what you said',
      type: 'button',
      action: 'click',
    },
  ],
};
