import type { FormSchema } from './types.js';

export const settingsTabsSchema: FormSchema = {
  formKey: 'settings.tabs',
  page: '/settings',
  title: 'Settings — sidebar tabs',
  purpose: 'Switch between Profile, Security, Notifications, Data, and AI usage sections.',
  fields: [
    { key: 'profile', label: 'Profile tab', type: 'tab', action: 'click' },
    { key: 'security', label: 'Security tab', type: 'tab', action: 'click' },
    { key: 'notifications', label: 'Notifications tab', type: 'tab', action: 'click' },
    { key: 'data', label: 'Data and Storage tab', type: 'tab', action: 'click' },
    { key: 'usage', label: 'AI usage tab', type: 'tab', action: 'click' },
    { key: 'reset_token_usage', label: 'Reset AI token usage counters', type: 'button', action: 'click' },
    { key: 'sign_out', label: 'Sign out', type: 'button', action: 'click' },
  ],
};

export const settingsProfileSchema: FormSchema = {
  formKey: 'settings.profile',
  page: '/settings',
  pageQuery: { tab: 'profile' },
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
    { key: 'voice_tts_enabled', label: 'Speak confirmations (TTS)', type: 'checkbox' },
    { key: 'save', label: 'Save profile changes', type: 'button', action: 'click' },
  ],
};
