import type { FormSchema } from './types.js';

/** Voice + LLM assistant strip on /simulate (describe, mic, pre-fill run). */
export const simulateRunAssistantSchema: FormSchema = {
  formKey: 'simulate.run.assistant',
  page: '/simulate',
  title: 'Run simulation — voice assistant',
  purpose:
    'Natural-language and voice input to pick an accessible simulation template, personas, and runner inputs. Does not start the run—user reviews then Configure test / Start simulation.',
  fields: [
    {
      key: 'describe',
      label: 'Describe what you want to simulate',
      type: 'textarea',
      description: 'Type or dictate; Build it for me picks template, personas, and fills text fields where possible.',
    },
    { key: 'mic_toggle', label: 'Voice describe simulation run', type: 'button', action: 'click' },
    { key: 'generate', label: 'Fill simulation run from description', type: 'button', action: 'click' },
  ],
};
