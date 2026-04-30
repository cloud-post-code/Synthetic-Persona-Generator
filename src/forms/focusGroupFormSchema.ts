import type { FormSchema } from './types.js';

export const focusGroupCreateFormSchema: FormSchema = {
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
      key: 'allowed_role',
      label: 'Allowed persona role',
      type: 'select',
      dbColumn: 'allowed_persona_types',
      options: [
        { value: '', label: 'All personas' },
        { value: 'synthetic_user', label: 'Synthetic User' },
        { value: 'advisor', label: 'Advisor' },
      ],
    },
    { key: 'cancel', label: 'Cancel', type: 'button', action: 'click' },
    { key: 'submit', label: 'Create focus group', type: 'button', action: 'click' },
  ],
};

export const focusGroupEditFormSchema: FormSchema = {
  formKey: 'focus_groups.edit',
  page: '/gallery',
  pageQuery: { tab: 'focusGroups' },
  title: 'Focus group — edit',
  purpose: 'Rename a focus group, change role filter, and add or remove personas.',
  persistsTo: ['focus_groups', 'focus_group_personas'],
  submitTargetId: 'focus_groups.edit.save',
  fields: [
    { key: 'name', label: 'Focus group name', type: 'text', dbColumn: 'name', required: true },
    {
      key: 'allowed_role',
      label: 'Allowed persona role',
      type: 'select',
      dbColumn: 'allowed_persona_types',
      options: [
        { value: '', label: 'All personas' },
        { value: 'synthetic_user', label: 'Synthetic User' },
        { value: 'advisor', label: 'Advisor' },
      ],
    },
    { key: 'close', label: 'Close edit modal', type: 'button', action: 'click' },
    { key: 'save', label: 'Save focus group', type: 'button', action: 'click' },
  ],
};
