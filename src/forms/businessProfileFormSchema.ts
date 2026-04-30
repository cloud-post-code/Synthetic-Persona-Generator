import type { FormSchema } from './types.js';

/**
 * Mirrors columns from `business_profiles` table (see backend/src/migrations/schema.sql).
 * Every voice target id resolves to `business.profile.<dbColumn>` so the agent can
 * reason directly from the live DB shape.
 */
export const businessProfileFormSchema: FormSchema = {
  formKey: 'business.profile',
  page: '/business-profile',
  title: 'Business profile',
  purpose:
    'Edit the runner company background used across personas and simulations. Saves to business_profiles.',
  persistsTo: ['business_profiles'],
  submitTargetId: 'business.profile.save',
  fields: [
    {
      key: 'business_name',
      dbColumn: 'business_name',
      label: 'Business name',
      type: 'text',
    },
    {
      key: 'mission_statement',
      dbColumn: 'mission_statement',
      label: 'Mission statement',
      type: 'textarea',
      description: "What is your company's mission?",
    },
    {
      key: 'vision_statement',
      dbColumn: 'vision_statement',
      label: 'Vision statement',
      type: 'textarea',
      description: 'Where is your company headed?',
    },
    {
      key: 'description_main_offerings',
      dbColumn: 'description_main_offerings',
      label: 'Description of main offerings',
      type: 'textarea',
    },
    {
      key: 'key_features_or_benefits',
      dbColumn: 'key_features_or_benefits',
      label: 'Key features or benefits',
      type: 'textarea',
    },
    {
      key: 'unique_selling_proposition',
      dbColumn: 'unique_selling_proposition',
      label: 'Unique selling proposition',
      type: 'textarea',
    },
    {
      key: 'pricing_model',
      dbColumn: 'pricing_model',
      label: 'Pricing model',
      type: 'textarea',
      examples: ['subscription', 'one-time', 'tiered'],
    },
    {
      key: 'website',
      dbColumn: 'website',
      label: 'Website',
      type: 'url',
    },
    {
      key: 'customer_segments',
      dbColumn: 'customer_segments',
      label: 'Customer segments',
      type: 'textarea',
    },
    {
      key: 'geographic_focus',
      dbColumn: 'geographic_focus',
      label: 'Geographic focus',
      type: 'textarea',
    },
    {
      key: 'industry_served',
      dbColumn: 'industry_served',
      label: 'Industry served',
      type: 'text',
      examples: ['B2B', 'B2C', 'both'],
    },
    {
      key: 'what_differentiates',
      dbColumn: 'what_differentiates',
      label: 'What differentiates the company',
      type: 'textarea',
    },
    {
      key: 'market_niche',
      dbColumn: 'market_niche',
      label: 'Market niche',
      type: 'textarea',
    },
    {
      key: 'distribution_channels',
      dbColumn: 'distribution_channels',
      label: 'Distribution channels',
      type: 'textarea',
    },
    {
      key: 'key_personnel',
      dbColumn: 'key_personnel',
      label: 'Key personnel',
      type: 'textarea',
    },
    {
      key: 'major_achievements',
      dbColumn: 'major_achievements',
      label: 'Major achievements',
      type: 'textarea',
    },
    {
      key: 'revenue',
      dbColumn: 'revenue',
      label: 'Revenue',
      type: 'textarea',
    },
    {
      key: 'key_performance_indicators',
      dbColumn: 'key_performance_indicators',
      label: 'Key performance indicators',
      type: 'textarea',
    },
    {
      key: 'funding_rounds',
      dbColumn: 'funding_rounds',
      label: 'Funding rounds',
      type: 'textarea',
      examples: ['Seed', 'Series A'],
    },
    {
      key: 'revenue_streams',
      dbColumn: 'revenue_streams',
      label: 'Revenue streams',
      type: 'textarea',
    },
    {
      key: 'save',
      label: 'Save business profile',
      type: 'button',
      action: 'click',
    },
  ],
};
