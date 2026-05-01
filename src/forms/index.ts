/**
 * Central registry of every form schema in the app. The corpus generator and
 * the planner consume this list to know what fields exist where, even when
 * those fields are not currently mounted in the DOM.
 */

import { businessProfileFormSchema } from './businessProfileFormSchema.js';
import {
  buildPersonaSchemas,
  buildPersonaAssistantSchema,
  buildPersonaPickerSchema,
  buildPersonaVisibilitySchema,
  buildSyntheticProblemSolutionSchema,
  buildSyntheticSupportingDocsSchema,
  buildSyntheticBusinessProfileSchema,
  buildAdvisorLinkedinSchema,
  buildAdvisorPdfSchema,
  buildAdvisorFreeTextSchema,
} from './buildPersonaFormSchemas.js';
import { simulationTemplateFormSchema } from './simulationTemplateFormSchema.js';
import { simulateRunAssistantSchema } from './simulateRunAssistantSchema.js';
import { settingsTabsSchema, settingsProfileSchema } from './settingsFormSchema.js';
import { chatComposerSchema, chatSessionSchema } from './chatFormSchema.js';
import { loginFormSchema } from './loginFormSchema.js';
import {
  focusGroupCreateFormSchema,
  focusGroupEditFormSchema,
} from './focusGroupFormSchema.js';
import type { FormSchema } from './types.js';

export const ALL_FORM_SCHEMAS: FormSchema[] = [
  loginFormSchema,
  businessProfileFormSchema,
  ...buildPersonaSchemas,
  simulationTemplateFormSchema,
  simulateRunAssistantSchema,
  settingsTabsSchema,
  settingsProfileSchema,
  chatComposerSchema,
  chatSessionSchema,
  focusGroupCreateFormSchema,
  focusGroupEditFormSchema,
];

export {
  loginFormSchema,
  businessProfileFormSchema,
  buildPersonaSchemas,
  buildPersonaAssistantSchema,
  buildPersonaPickerSchema,
  buildPersonaVisibilitySchema,
  buildSyntheticProblemSolutionSchema,
  buildSyntheticSupportingDocsSchema,
  buildSyntheticBusinessProfileSchema,
  buildAdvisorLinkedinSchema,
  buildAdvisorPdfSchema,
  buildAdvisorFreeTextSchema,
  simulationTemplateFormSchema,
  simulateRunAssistantSchema,
  settingsTabsSchema,
  settingsProfileSchema,
  chatComposerSchema,
  chatSessionSchema,
  focusGroupCreateFormSchema,
  focusGroupEditFormSchema,
};

export * from './types.js';
