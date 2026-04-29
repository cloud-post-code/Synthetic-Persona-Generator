/** Mirror of frontend src/voice/intents.ts for server-side validation */

export type CompletionSignal =
  | { type: 'route'; path: string; query?: Record<string, string> }
  | { type: 'event'; name: string }
  | { type: 'target_visible'; target_id: string }
  | { type: 'predicate'; id: string };

export type UiTransition = {
  to: string;
  via: 'navigate' | 'action' | 'set_query';
  label: string;
  targetId?: string;
};

export type UiGoal = {
  id: string;
  description: string;
  completion: CompletionSignal;
};

export type UiNode = {
  id: string;
  title: string;
  path: string;
  query?: Record<string, string>;
  purpose: string;
  whenToUse: string[];
  prerequisites?: {
    auth?: 'user' | 'admin';
    needs?: string[];
  };
  transitions: UiTransition[];
  goals: UiGoal[];
  speakOnArrival?: string;
};

export type VoiceTargetEntry = {
  id: string;
  label: string;
  action: 'click' | 'focus' | 'fill';
};

export type VoiceIntent =
  | {
      type: 'navigate';
      path: string;
      query?: Record<string, string>;
      reason: string;
      goalId?: string;
    }
  | {
      type: 'set_query';
      query: Record<string, string>;
      reason: string;
      goalId?: string;
    }
  | {
      type: 'action';
      target_id: string;
      value?: string;
      reason: string;
      goalId?: string;
    }
  | { type: 'speak'; text: string }
  | { type: 'clarify'; question: string; options?: string[] }
  | { type: 'goal_complete'; goalId: string; summary: string }
  | { type: 'unsupported'; reason: string };

export type ActiveGoalContext = {
  goalId: string;
  description: string;
  completion: CompletionSignal;
  stepsTaken: number;
  maxSteps: number;
  startedAt: number;
};

export function isVoiceIntent(value: unknown): value is VoiceIntent {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const t = o.type;
  switch (t) {
    case 'navigate':
      return typeof o.path === 'string' && typeof o.reason === 'string';
    case 'set_query':
      return typeof o.query === 'object' && o.query !== null && typeof o.reason === 'string';
    case 'action':
      return typeof o.target_id === 'string' && typeof o.reason === 'string';
    case 'speak':
      return typeof o.text === 'string';
    case 'clarify':
      return typeof o.question === 'string';
    case 'goal_complete':
      return typeof o.goalId === 'string' && typeof o.summary === 'string';
    case 'unsupported':
      return typeof o.reason === 'string';
    default:
      return false;
  }
}
