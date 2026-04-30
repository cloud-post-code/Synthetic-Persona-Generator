import type { VoiceTargetEntry, ActiveGoalContext } from './voiceIntents.js';

export type VoiceIntentRequest = {
  transcript: string;
  context: {
    pathname: string;
    search: string;
    isAuthenticated: boolean;
    isAdmin: boolean;
    visibleTargets: VoiceTargetEntry[];
    currentNodeId: string | null;
    activeGoal: ActiveGoalContext | null;
  };
  uiMapPrompt: string;
};
