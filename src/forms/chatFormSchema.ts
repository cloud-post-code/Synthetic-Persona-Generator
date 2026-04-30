import type { FormSchema } from './types.js';

export const chatComposerSchema: FormSchema = {
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
};

export const chatSessionSchema: FormSchema = {
  formKey: 'chat.session',
  page: '/chat',
  title: 'Chat — session controls',
  purpose: 'Manage the current chat session (rename, switch persona, etc.).',
  persistsTo: ['chat_sessions', 'chat_session_personas'],
  fields: [
    { key: 'rename_session', label: 'Rename current chat session', type: 'button', action: 'click' },
    { key: 'open_persona_picker', label: 'Open persona picker', type: 'button', action: 'click' },
  ],
};
