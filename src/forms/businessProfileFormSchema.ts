import type { FormSchema } from './types.js';
import {
  BUSINESS_PROFILE_SPEC,
  businessProfileAnswerKey,
} from '../constants/businessProfileSpec.js';

function buildBusinessProfileFormFields() {
  const fields: FormSchema['fields'] = [
    {
      key: 'company_hint',
      dbColumn: 'company_hint',
      label: 'Company name or website (optional)',
      type: 'text',
      description:
        'Optional company or URL; saved with your profile and reused whenever you generate from documents (no need to re-enter each time).',
    },
  ];
  for (const sec of BUSINESS_PROFILE_SPEC) {
    for (const fw of sec.frameworks) {
      for (const q of fw.questions) {
        const key = businessProfileAnswerKey(sec.key, fw.key, q.key);
        fields.push({
          key,
          dbColumn: key,
          label: q.label,
          type: 'textarea',
          description: `${sec.title} — ${fw.title}. ${fw.description}`,
        });
      }
    }
  }
  fields.push({
    key: 'generate_file',
    label: 'Documents for AI generation (optional)',
    type: 'button',
    action: 'click',
    description:
      'Optional files for “Generate with AI” on this device only; not stored on the server (pick again after reload).',
  });
  fields.push({
    key: 'save',
    label: 'Save business profile (sync now)',
    type: 'button',
    action: 'click',
  });
  return fields;
}

/**
 * Voice / planner: one fill target per question. Keys match `answers` in business_profiles.
 */
export const businessProfileFormSchema: FormSchema = {
  formKey: 'business.profile',
  page: '/business-profile',
  title: 'Business profile',
  purpose:
    'Structured Business Profile Builder (disciplined entrepreneurship). Answers auto-save to business_profiles.answers (JSON).',
  persistsTo: ['business_profiles'],
  submitTargetId: 'business.profile.save',
  fields: buildBusinessProfileFormFields(),
};
