import type { FormSchema } from './types.js';

/** Login form. Fields use stable IDs aliased from the legacy `login.username`/`login.submit`. */
export const loginFormSchema: FormSchema = {
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
};
