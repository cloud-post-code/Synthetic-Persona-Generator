/**
 * Named intents → deterministic template steps (expanded server-side to VoiceIntent[]).
 * Keep triggers aligned with UI map nodes in uiMapData.ts.
 */

export type SlotPlaceholder = { slot: string };

export type TemplateStep =
  | { type: 'navigate'; nodeId: string; query?: Record<string, string | SlotPlaceholder> }
  | { type: 'set_query'; query: Record<string, string | SlotPlaceholder> }
  | {
      type: 'action';
      targetId?: string;
      targetPattern?: string;
      value?: string | SlotPlaceholder;
      /** Skip this step if substituted value is empty */
      skipIfEmpty?: boolean;
    };

export type ResolverDomain = 'persona' | 'focusGroup' | 'simulationTemplate' | 'chat';

export type SlotSpec = {
  name: string;
  required: boolean;
  description: string;
  promptIfMissing: string;
  extractors?: Array<'email' | 'quoted' | 'after_keyword' | 'username'>;
  forbidVoiceCapture?: boolean;
  resolver?: {
    domain: ResolverDomain;
    returns?: 'id' | 'name';
  };
};

export type IntentTemplate = {
  name: string;
  description: string;
  triggers: { phrases: string[]; keywords: string[] };
  prerequisites?: { auth?: 'user' | 'admin'; pathnamePrefix?: string };
  slots: SlotSpec[];
  steps: TemplateStep[];
};

export const INTENT_TEMPLATES: IntentTemplate[] = [
  {
    name: 'OPEN_GALLERY_SAVED',
    description: 'Open gallery Saved personas tab',
    triggers: {
      phrases: ['saved personas', 'saved tab', 'my saved personas'],
      keywords: ['saved', 'gallery'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'gallery.saved' }],
  },
  {
    name: 'OPEN_GALLERY_LIBRARY',
    description: 'Open gallery Library tab',
    triggers: {
      phrases: ['persona library', 'library tab', 'browse library'],
      keywords: ['library', 'gallery'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'gallery.library' }],
  },
  {
    name: 'OPEN_GALLERY_FOCUS',
    description: 'Open gallery Focus groups tab',
    triggers: {
      phrases: ['focus groups tab', 'focus group tab', 'open focus groups'],
      keywords: ['focus', 'groups', 'cohort'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'gallery.focus' }],
  },
  {
    name: 'OPEN_BUILD_PERSONA',
    description: 'Open Build Persona',
    triggers: {
      phrases: ['build persona', 'create persona', 'persona builder', 'new persona'],
      keywords: ['build', 'persona'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'build.persona' }],
  },
  {
    name: 'OPEN_BUSINESS_PROFILE',
    description: 'Open Business profile',
    triggers: {
      phrases: ['business profile', 'company profile'],
      keywords: ['business', 'company'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'business.profile' }],
  },
  {
    name: 'OPEN_SIMULATIONS_HUB',
    description: 'Open Simulations hub',
    triggers: {
      phrases: ['simulations hub', 'simulation templates'],
      keywords: ['simulations', 'templates'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'simulations.hub' }],
  },
  {
    name: 'OPEN_DASHBOARD',
    description: 'Open Home / Dashboard',
    triggers: {
      phrases: ['go home', 'open dashboard', 'main page'],
      keywords: ['dashboard', 'home'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'home.dashboard' }],
  },
  {
    name: 'OPEN_SETTINGS',
    description: 'Open Settings',
    triggers: {
      phrases: ['open settings', 'account settings'],
      keywords: ['settings', 'preferences'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [{ type: 'navigate', nodeId: 'settings.page' }],
  },
  {
    name: 'SUBMIT_LOGIN',
    description: 'Sign in on the login page',
    triggers: {
      phrases: ['sign in', 'log in', 'login', 'submit login'],
      keywords: ['sign', 'login', 'password'],
    },
    prerequisites: {},
    slots: [
      {
        name: 'username',
        required: false,
        description: 'Account username',
        promptIfMissing: 'What username should I use?',
        extractors: ['email', 'username'],
      },
    ],
    steps: [
      { type: 'navigate', nodeId: 'auth.login' },
      { type: 'action', targetId: 'login.username', value: { slot: 'username' }, skipIfEmpty: true },
      { type: 'action', targetId: 'login.submit' },
    ],
  },
  {
    name: 'SAVE_BUSINESS_PROFILE',
    description: 'Save business profile',
    triggers: {
      phrases: ['save business profile', 'save company profile', 'save profile'],
      keywords: ['save', 'business'],
    },
    prerequisites: { auth: 'user' },
    slots: [],
    steps: [
      { type: 'navigate', nodeId: 'business.profile' },
      { type: 'action', targetId: 'business.save', targetPattern: 'save' },
    ],
  },
  {
    name: 'OPEN_PERSONA_CHAT',
    description: 'Open chat with a persona by name',
    triggers: {
      phrases: ['chat with', 'talk to', 'open chat with'],
      keywords: ['chat', 'persona', 'talk'],
    },
    prerequisites: { auth: 'user' },
    slots: [
      {
        name: 'personaName',
        required: true,
        description: 'Persona display name',
        promptIfMissing: 'Which persona do you want to chat with?',
        extractors: ['quoted', 'after_keyword'],
        resolver: { domain: 'persona', returns: 'id' },
      },
    ],
    steps: [
      {
        type: 'navigate',
        nodeId: 'chat.thread',
        query: { personaId: { slot: 'personaName' } },
      },
    ],
  },
  {
    name: 'RUN_SIMULATION_TEMPLATE',
    description: 'Open Run simulation with a template',
    triggers: {
      phrases: ['run simulation', 'start simulation', 'open simulate'],
      keywords: ['simulation', 'template', 'run'],
    },
    prerequisites: { auth: 'user' },
    slots: [
      {
        name: 'templateName',
        required: true,
        description: 'Simulation template title',
        promptIfMissing: 'Which simulation template should I run?',
        extractors: ['quoted', 'after_keyword'],
        resolver: { domain: 'simulationTemplate', returns: 'id' },
      },
    ],
    steps: [
      {
        type: 'navigate',
        nodeId: 'simulate.run',
        query: { templateId: { slot: 'templateName' } },
      },
    ],
  },
  {
    name: 'OPEN_FOCUS_GROUP_TAB',
    description: 'Open Focus groups and optionally select a group by name',
    triggers: {
      phrases: ['open focus group', 'show focus group', 'my focus groups'],
      keywords: ['focus', 'group'],
    },
    prerequisites: { auth: 'user' },
    slots: [
      {
        name: 'focusGroupName',
        required: false,
        description: 'Focus group name',
        promptIfMissing: 'Which focus group?',
        extractors: ['quoted', 'after_keyword'],
        resolver: { domain: 'focusGroup', returns: 'id' },
      },
    ],
    steps: [
      {
        type: 'navigate',
        nodeId: 'gallery.focus',
        query: { focusGroupId: { slot: 'focusGroupName' } },
      },
    ],
  },
];

function normalizeTranscript(t: string): string {
  return t.trim().toLowerCase();
}

/** Keyword hits per template (for fallback clarify options). */
export function scoreTemplatesByKeyword(transcript: string): Map<string, number> {
  const t = normalizeTranscript(transcript);
  const scores = new Map<string, number>();
  for (const it of INTENT_TEMPLATES) {
    let s = 0;
    for (const kw of it.triggers.keywords) {
      if (t.includes(kw.toLowerCase())) s += 1;
    }
    scores.set(it.name, s);
  }
  return scores;
}

export function topKIntentsByKeyword(transcript: string, k: number): IntentTemplate[] {
  const scores = scoreTemplatesByKeyword(transcript);
  return [...INTENT_TEMPLATES]
    .map((it) => ({ it, score: scores.get(it.name) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
    .filter((x) => x.score > 0)
    .slice(0, k)
    .map((x) => x.it);
}

export function getIntentByName(name: string): IntentTemplate | undefined {
  return INTENT_TEMPLATES.find((t) => t.name === name);
}

export function listIntentSummariesForLLM(): string {
  return INTENT_TEMPLATES.map((t) => `- ${t.name}: ${t.description}`).join('\n');
}
