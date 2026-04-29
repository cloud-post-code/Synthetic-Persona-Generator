import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { commandBus } from './commandBus.js';
import { buildUiMapForPrompt, findNodeId } from './uiMap.js';
import { initTaskTrackerBus, taskTracker } from './taskTracker.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';
import type { VoiceIntent } from './intents.js';
import { postVoiceIntent } from './voiceApi.js';
import { cancelSpeech, speak as speakTts } from './tts.js';
import { isVoiceAgentEnabled, isVoiceTtsEnabled } from './voiceSettings.js';

export type VoiceAgentState = 'idle' | 'listening' | 'thinking' | 'acting' | 'speaking';

type VoiceAgentContextValue = {
  agentState: VoiceAgentState;
  lastTranscript: string;
  lastError: string | null;
  lastIntentSummary: string | null;
  /** Start push-to-talk listening */
  startListening: () => void;
  stopListening: () => void;
  /** Whether mic UI should show (logged in + enabled in settings) */
  isDockVisible: boolean;
  /** Ref to attach interim results from dock / recognition */
  pushTranscript: (text: string, isFinal: boolean) => void;
};

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

function maybeSpeak(text: string) {
  if (isVoiceTtsEnabled()) speakTts(text);
}

function executeDomAction(targetId: string, action: 'click' | 'focus' | 'fill', value?: string) {
  const safe = targetId.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(`[data-voice-target="${safe}"]`);
  if (!el) return false;
  commandBus.emit({ type: 'voice:action', targetId, action, value });
  if (action === 'click' && el instanceof HTMLButtonElement) {
    el.click();
    return true;
  }
  if (action === 'click' && el instanceof HTMLAnchorElement) {
    el.click();
    return true;
  }
  if (action === 'click') {
    el.click();
    return true;
  }
  if (action === 'focus') {
    el.focus();
    return true;
  }
  if (action === 'fill' && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    el.focus();
    el.value = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin } = useAuth();
  const [agentState, setAgentState] = useState<VoiceAgentState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastIntentSummary, setLastIntentSummary] = useState<string | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);
  const processingRef = useRef(false);

  useEffect(() => {
    const onSettings = () => setSettingsTick((t) => t + 1);
    window.addEventListener('voice-settings-changed', onSettings);
    return () => window.removeEventListener('voice-settings-changed', onSettings);
  }, []);

  useEffect(() => {
    const unsub = initTaskTrackerBus();
    return unsub;
  }, []);

  void settingsTick;
  const isDockVisible = !!user && !loading && isVoiceAgentEnabled();

  const runIntent = useCallback(
    async (intent: VoiceIntent) => {
      setAgentState('acting');
      setLastIntentSummary(intent.type);

      const speakReason = (reason?: string) => {
        if (reason && isVoiceTtsEnabled()) maybeSpeak(reason);
      };

      if (
        intent.goalId &&
        !taskTracker.getActiveGoalContext() &&
        (intent.type === 'navigate' || intent.type === 'set_query' || intent.type === 'action')
      ) {
        taskTracker.start(intent.goalId);
      }

      const activeGoal = taskTracker.getActiveGoalContext();
      if (activeGoal && intent.type !== 'goal_complete' && intent.type !== 'speak' && intent.type !== 'clarify' && intent.type !== 'unsupported') {
        if (intent.type === 'navigate') {
          const ok = taskTracker.intentAllowedForActiveGoal(intent.path, intent.query);
          if (!ok) {
            maybeSpeak('That would take us off the current task. Say cancel to stop the task.');
            setAgentState('idle');
            return;
          }
        }
      }

      switch (intent.type) {
        case 'navigate': {
          const search = intent.query ? `?${new URLSearchParams(intent.query).toString()}` : '';
          navigate({ pathname: intent.path, search });
          taskTracker.recordStep();
          speakReason(intent.reason);
          break;
        }
        case 'set_query': {
          const sp = new URLSearchParams(location.search.replace(/^\?/, ''));
          for (const [k, v] of Object.entries(intent.query)) {
            sp.set(k, v);
          }
          navigate({ pathname: location.pathname, search: sp.toString() ? `?${sp.toString()}` : '' });
          taskTracker.recordStep();
          speakReason(intent.reason);
          break;
        }
        case 'action': {
          const entry = voiceTargetRegistry.get(intent.target_id);
          const action = entry?.action || 'click';
          const ok = executeDomAction(intent.target_id, action, intent.value);
          if (!ok) maybeSpeak('Could not run that action.');
          taskTracker.recordStep();
          speakReason(intent.reason);
          break;
        }
        case 'speak':
          maybeSpeak(intent.text);
          break;
        case 'clarify':
          maybeSpeak(intent.question);
          break;
        case 'goal_complete':
          taskTracker.complete(intent.goalId);
          maybeSpeak(intent.summary);
          break;
        case 'unsupported':
          maybeSpeak(intent.reason);
          break;
        default:
          break;
      }

      let pathAfter = location.pathname;
      let searchAfter = location.search;
      if (intent.type === 'navigate') {
        pathAfter = intent.path;
        searchAfter = intent.query ? `?${new URLSearchParams(intent.query).toString()}` : '';
      } else if (intent.type === 'set_query') {
        const sp = new URLSearchParams(location.search.replace(/^\?/, ''));
        for (const [k, v] of Object.entries(intent.query)) {
          sp.set(k, v);
        }
        searchAfter = sp.toString() ? `?${sp.toString()}` : '';
      }

      const visibleIds = new Set(voiceTargetRegistry.list().map((t) => t.id));
      const done = taskTracker.checkCompletion({
        pathname: pathAfter,
        search: searchAfter,
        visibleTargetIds: visibleIds,
      });
      if (done && taskTracker.getActiveGoalContext()) {
        const g = taskTracker.getActiveGoalContext();
        if (g) {
          taskTracker.complete(g.goalId);
          maybeSpeak('Task complete.');
        }
      }

      setAgentState(isVoiceTtsEnabled() ? 'speaking' : 'idle');
      if (isVoiceTtsEnabled()) {
        const wait = window.speechSynthesis ? 400 : 0;
        setTimeout(() => setAgentState('idle'), wait);
      } else {
        setAgentState('idle');
      }
    },
    [navigate, location.pathname, location.search]
  );

  const processFinalTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;
      const lower = trimmed.toLowerCase();
      if (/\b(stop|cancel|never mind)\b/i.test(lower)) {
        taskTracker.cancel();
        cancelSpeech();
        maybeSpeak('Cancelled.');
        setAgentState('idle');
        return;
      }

      processingRef.current = true;
      setAgentState('thinking');
      setLastError(null);

      try {
        const currentNodeId = findNodeId(location.pathname, location.search);
        const uiMapPrompt = buildUiMapForPrompt(currentNodeId, {
          isAuthenticated: !!user,
          isAdmin,
        });
        const intent = await postVoiceIntent({
          transcript: trimmed,
          context: {
            pathname: location.pathname,
            search: location.search,
            isAuthenticated: !!user,
            isAdmin,
            visibleTargets: voiceTargetRegistry.list(),
            currentNodeId,
            activeGoal: taskTracker.getActiveGoalContext(),
          },
          uiMapPrompt,
        });

        await runIntent(intent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed.';
        setLastError(msg);
        maybeSpeak('Sorry, something went wrong.');
        setAgentState('idle');
      } finally {
        processingRef.current = false;
      }
    },
    [user, isAdmin, location.pathname, location.search, runIntent]
  );

  const pushTranscript = useCallback((text: string, isFinal: boolean) => {
    setLastTranscript(text);
    if (isFinal) {
      void processFinalTranscript(text);
    }
  }, [processFinalTranscript]);

  const startListening = useCallback(() => {
    setLastError(null);
    setAgentState('listening');
  }, []);

  const stopListening = useCallback(() => {
    if (agentState === 'listening') setAgentState('idle');
  }, [agentState]);

  const value = useMemo(
    () => ({
      agentState,
      lastTranscript,
      lastError,
      lastIntentSummary,
      startListening,
      stopListening,
      isDockVisible,
      pushTranscript,
    }),
    [agentState, lastTranscript, lastError, lastIntentSummary, startListening, stopListening, isDockVisible, pushTranscript]
  );

  return <VoiceAgentContext.Provider value={value}>{children}</VoiceAgentContext.Provider>;
}

export function useVoiceAgent() {
  const ctx = useContext(VoiceAgentContext);
  if (!ctx) throw new Error('useVoiceAgent must be used within VoiceAgentProvider');
  return ctx;
}
