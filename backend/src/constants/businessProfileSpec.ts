/**
 * Disciplined entrepreneurship — Business Profile Builder spec.
 * Mirror of ../../src/constants/businessProfileSpec.ts — keep identical.
 */

export type BusinessProfileQuestion = { key: string; label: string };

export type BusinessProfileFramework = {
  key: string;
  title: string;
  description: string;
  questions: BusinessProfileQuestion[];
};

export type BusinessProfileSectionKey =
  | 'who_is_customer'
  | 'problem_solution'
  | 'acquisition'
  | 'monetization'
  | 'product_design'
  | 'building_scaling';

export type BusinessProfileSection = {
  key: BusinessProfileSectionKey;
  title: string;
  shortLabel: string;
  frameworks: BusinessProfileFramework[];
};

/** Stable answer key: section.framework.question */
export function businessProfileAnswerKey(
  sectionKey: string,
  frameworkKey: string,
  questionKey: string
): string {
  return `${sectionKey}.${frameworkKey}.${questionKey}`;
}

/** Framework id for scope picker: section.framework */
export function businessProfileFrameworkId(sectionKey: string, frameworkKey: string): string {
  return `${sectionKey}.${frameworkKey}`;
}

export const BUSINESS_PROFILE_SPEC: readonly BusinessProfileSection[] = [
  {
    key: 'who_is_customer',
    title: 'Who is your customer',
    shortLabel: 'Customer',
    frameworks: [
      {
        key: 'target_customer_persona',
        title: 'Target Customer Persona',
        description: 'Define the primary buyer or user you serve first.',
        questions: [
          { key: 'primary_customer', label: 'Who is your primary customer?' },
          { key: 'job_title_role', label: 'What is their job/title or role?' },
          { key: 'industry', label: 'What industry are they in?' },
          { key: 'demographic_profile', label: 'What is their demographic profile?' },
          { key: 'goals', label: 'What are their goals?' },
          { key: 'frustrations', label: 'What are their frustrations?' },
        ],
      },
      {
        key: 'beachhead_market',
        title: 'Beachhead Market',
        description: 'The first niche you will win before expanding.',
        questions: [
          { key: 'niche_first', label: 'What specific niche are you targeting first?' },
          { key: 'why_niche', label: 'Why this niche?' },
          { key: 'segment_size', label: 'How large is this segment?' },
          { key: 'group_accessible', label: 'What makes this group accessible?' },
        ],
      },
      {
        key: 'customer_segmentation',
        title: 'Customer Segmentation',
        description: 'How you slice the market and prioritize.',
        questions: [
          { key: 'segments', label: 'What are the different customer segments?' },
          { key: 'priority_segment', label: 'Which segment is the highest priority?' },
          { key: 'segment_differentiators', label: 'What differentiates each segment?' },
        ],
      },
    ],
  },
  {
    key: 'problem_solution',
    title: 'Customer problem & solution',
    shortLabel: 'Problem & solution',
    frameworks: [
      {
        key: 'problem_definition',
        title: 'Problem Definition',
        description: 'The pain you are solving and its severity.',
        questions: [
          { key: 'core_problem', label: 'What is the core problem?' },
          { key: 'frequency', label: 'How frequently does this problem occur?' },
          { key: 'pain_level_1_10', label: 'How painful is it (1–10)?' },
          { key: 'if_unsolved', label: "What happens if it's not solved?" },
        ],
      },
      {
        key: 'current_alternatives',
        title: 'Current Alternatives',
        description: 'How buyers cope today and why that fails.',
        questions: [
          { key: 'solve_today', label: 'How do customers solve this today?' },
          { key: 'limitations', label: 'What are the limitations of current solutions?' },
          { key: 'insufficient_why', label: 'Why are these solutions insufficient?' },
        ],
      },
      {
        key: 'your_solution',
        title: 'Your Solution',
        description: 'Your product and its edge.',
        questions: [
          { key: 'product', label: 'What is your product?' },
          { key: 'how_solves', label: 'How does it solve the problem?' },
          { key: 'uniqueness', label: 'What makes your solution unique?' },
          { key: 'vs_alternatives', label: 'Why is it better than alternatives?' },
        ],
      },
      {
        key: 'value_proposition',
        title: 'Value Proposition',
        description: 'The outcome and reason to care.',
        questions: [
          { key: 'main_benefit', label: 'What is the main benefit to the customer?' },
          { key: 'outcome', label: 'What outcome do they achieve?' },
          { key: 'why_care', label: 'Why should they care?' },
        ],
      },
    ],
  },
  {
    key: 'acquisition',
    title: 'Customer acquisition',
    shortLabel: 'Acquisition',
    frameworks: [
      {
        key: 'customer_journey',
        title: 'Customer Journey',
        description: 'From discovery to purchase.',
        questions: [
          { key: 'discovery', label: 'How does a customer discover your product?' },
          { key: 'steps_before_purchase', label: 'What steps do they take before buying?' },
          { key: 'hesitation_points', label: 'Where do they hesitate?' },
        ],
      },
      {
        key: 'acquisition_channels',
        title: 'Acquisition Channels',
        description: 'Where you reach buyers.',
        questions: [
          { key: 'channels_list', label: 'What channels will you use? (ads, outbound, content, etc.)' },
          { key: 'primary_channel', label: 'Which is your primary channel?' },
          { key: 'why_channel_works', label: 'Why will this channel work?' },
        ],
      },
      {
        key: 'sales_process',
        title: 'Sales Process',
        description: 'How deals close.',
        questions: [
          { key: 'self_serve_or_sales', label: 'Is this self-serve or sales-driven?' },
          { key: 'steps_to_close', label: 'What are the steps to close a customer?' },
          { key: 'sales_cycle', label: 'How long is the sales cycle?' },
        ],
      },
      {
        key: 'early_adopters_strategy',
        title: 'Early Adopters Strategy',
        description: 'Who tries you first and why.',
        questions: [
          { key: 'who_first', label: 'Who will adopt first?' },
          { key: 'how_reach', label: 'How will you reach them?' },
          { key: 'why_try_early', label: 'Why will they try your product early?' },
        ],
      },
    ],
  },
  {
    key: 'monetization',
    title: 'Monetization (how you make money)',
    shortLabel: 'Monetization',
    frameworks: [
      {
        key: 'revenue_model',
        title: 'Revenue Model',
        description: 'How you capture value.',
        questions: [
          { key: 'charge_model', label: 'How do you charge? (subscription, one-time, etc.)' },
          { key: 'pricing_structure', label: 'What is your pricing structure?' },
          { key: 'why_model', label: 'Why this pricing model?' },
        ],
      },
      {
        key: 'willingness_to_pay',
        title: 'Willingness to Pay',
        description: 'Price anchors and acceptability.',
        questions: [
          { key: 'problem_worth', label: 'How much is the problem worth solving?' },
          { key: 'current_spend', label: 'What do customers currently pay?' },
          { key: 'acceptable_price', label: 'What price feels acceptable?' },
        ],
      },
      {
        key: 'unit_economics',
        title: 'Unit Economics',
        description: 'CAC, LTV, margin.',
        questions: [
          { key: 'cac', label: 'Customer acquisition cost (CAC)?' },
          { key: 'ltv', label: 'Lifetime value (LTV)?' },
          { key: 'gross_margin', label: 'Gross margin?' },
        ],
      },
      {
        key: 'scaling_revenue',
        title: 'Scaling Revenue',
        description: 'Expansion and long-term revenue drivers.',
        questions: [
          { key: 'increase_per_customer', label: 'How do you increase revenue per customer?' },
          { key: 'upsell_expand', label: 'Can you upsell or expand?' },
          { key: 'long_term_growth', label: 'What drives long-term growth?' },
        ],
      },
    ],
  },
  {
    key: 'product_design',
    title: 'Product design (what it contains)',
    shortLabel: 'Product',
    frameworks: [
      {
        key: 'core_features',
        title: 'Core Features',
        description: 'MVP scope and must-haves.',
        questions: [
          { key: 'must_have', label: 'What are the must-have features?' },
          { key: 'mvp', label: 'What is the MVP?' },
          { key: 'exclude_now', label: 'What can be excluded for now?' },
        ],
      },
      {
        key: 'user_experience',
        title: 'User Experience',
        description: 'Flows and effortless moments.',
        questions: [
          { key: 'journey', label: 'What does the user journey look like?' },
          { key: 'key_interactions', label: 'What are key interactions?' },
          { key: 'effortless_where', label: 'Where must it feel effortless?' },
        ],
      },
      {
        key: 'differentiation',
        title: 'Differentiation',
        description: 'Moats and standout traits.',
        questions: [
          { key: 'stand_out', label: 'What makes your product stand out?' },
          { key: 'hard_to_replicate', label: 'What is hard to replicate?' },
          { key: 'unfair_advantage', label: 'What is your unfair advantage?' },
        ],
      },
      {
        key: 'product_roadmap',
        title: 'Product Roadmap',
        description: 'What comes after MVP.',
        questions: [
          { key: 'after_mvp', label: 'What comes after MVP?' },
          { key: 'next_features', label: 'What features come next?' },
          { key: 'prioritization', label: 'How do you prioritize?' },
        ],
      },
    ],
  },
  {
    key: 'building_scaling',
    title: 'Building & scaling the business',
    shortLabel: 'Building & scaling',
    frameworks: [
      {
        key: 'go_to_market_plan',
        title: 'Go-To-Market Plan',
        description: 'Launch and traction.',
        questions: [
          { key: 'launch_plan', label: 'How do you launch?' },
          { key: 'traction_strategy', label: 'What is your initial traction strategy?' },
          { key: 'success_metrics', label: 'What metrics define success?' },
        ],
      },
      {
        key: 'operations',
        title: 'Operations',
        description: 'Processes and systems.',
        questions: [
          { key: 'key_processes', label: 'What are the key processes?' },
          { key: 'tools_systems', label: 'What tools/systems are needed?' },
          { key: 'daily_smooth', label: 'What must run smoothly daily?' },
        ],
      },
      {
        key: 'team',
        title: 'Team',
        description: 'Roles and hiring order.',
        questions: [
          { key: 'key_roles', label: 'Who are the key roles?' },
          { key: 'skills_required', label: 'What skills are required?' },
          { key: 'hire_first', label: 'What will you hire first?' },
        ],
      },
      {
        key: 'scaling_strategy',
        title: 'Scaling Strategy',
        description: 'Growth risks and efficiency.',
        questions: [
          { key: 'when_grow', label: 'What happens when you grow?' },
          { key: 'breaks_first', label: 'What breaks first?' },
          { key: 'efficient_scale', label: 'How do you scale efficiently?' },
        ],
      },
    ],
  },
] as const;

let _allowedKeys: Set<string> | null = null;

export function getAllBusinessProfileAnswerKeys(): string[] {
  const keys: string[] = [];
  for (const sec of BUSINESS_PROFILE_SPEC) {
    for (const fw of sec.frameworks) {
      for (const q of fw.questions) {
        keys.push(businessProfileAnswerKey(sec.key, fw.key, q.key));
      }
    }
  }
  return keys;
}

export function getBusinessProfileAllowedAnswerKeySet(): Set<string> {
  if (!_allowedKeys) {
    _allowedKeys = new Set(getAllBusinessProfileAnswerKeys());
  }
  return _allowedKeys;
}

export function getAnswerKeysForSection(sectionKey: BusinessProfileSectionKey): string[] {
  const sec = BUSINESS_PROFILE_SPEC.find((s) => s.key === sectionKey);
  if (!sec) return [];
  const keys: string[] = [];
  for (const fw of sec.frameworks) {
    for (const q of fw.questions) {
      keys.push(businessProfileAnswerKey(sec.key, fw.key, q.key));
    }
  }
  return keys;
}

export function parseFrameworkId(id: string): { sectionKey: string; frameworkKey: string } | null {
  const parts = id.split('.');
  if (parts.length < 2) return null;
  const sectionKey = parts[0]!;
  const frameworkKey = parts.slice(1).join('.');
  return { sectionKey, frameworkKey };
}

/** What to inject as prompt context: whole profile or selected frameworks (section.framework). */
export type BusinessProfileScope =
  | { mode: 'all' }
  | { mode: 'frameworks'; frameworkIds: string[] };

export const DEFAULT_BUSINESS_PROFILE_SCOPE: BusinessProfileScope = { mode: 'all' };

export function normalizeBusinessProfileScope(raw: unknown): BusinessProfileScope {
  if (!raw || typeof raw !== 'object') return DEFAULT_BUSINESS_PROFILE_SCOPE;
  const o = raw as Record<string, unknown>;
  if (o.mode === 'frameworks' && Array.isArray(o.frameworkIds)) {
    const ids = o.frameworkIds.map((x) => String(x).trim()).filter(Boolean);
    return ids.length ? { mode: 'frameworks', frameworkIds: ids } : DEFAULT_BUSINESS_PROFILE_SCOPE;
  }
  return DEFAULT_BUSINESS_PROFILE_SCOPE;
}

/** Parse JSONB / API `answers` into trimmed string map. */
export function parseBusinessProfileAnswersJson(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** Plain-text block for one framework (embeddings / RAG). Empty if no answers. */
export function compileFrameworkPlainText(
  sectionKey: string,
  frameworkKey: string,
  answers: Record<string, string>
): string {
  const sec = BUSINESS_PROFILE_SPEC.find((s) => s.key === sectionKey);
  const fw = sec?.frameworks.find((f) => f.key === frameworkKey);
  if (!sec || !fw) return '';
  const lines: string[] = [`${sec.title} — ${fw.title}`, fw.description, ''];
  let any = false;
  for (const q of fw.questions) {
    const k = businessProfileAnswerKey(sectionKey, frameworkKey, q.key);
    const v = (answers[k] ?? '').trim();
    if (v) {
      any = true;
      lines.push(q.label, v, '');
    }
  }
  return any ? lines.join('\n').trim() : '';
}
