import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { commandBus } from './commandBus.js';
import { buildUiMapForPrompt, findNodeId } from './uiMap.js';
import { initTaskTrackerBus, taskTracker } from './taskTracker.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';
import type { VoiceIntent, VoiceIntentResult, VoiceTargetAction } from './intents.js';
import { isVoiceIntentBatch } from './intents.js';
import { postVoiceIntentForUser } from './voiceApi.js';
import { inferActionForElement, mergeVisibleVoiceTargets } from './scanVisibleVoiceTargets.js';
import { cancelSpeech, speak as speakTts } from './tts.js';
import { isVoiceAgentEnabled, isVoiceTtsEnabled } from './voiceSettings.js';
import {
  buildUndoBeforeIntent,
  matchesVoiceUndoCommand,
  voiceUndoStack,
  type UndoFn,
} from './voiceUndoStack.js';

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

function executeDomAction(targetId: string, action: VoiceTargetAction, value?: string) {
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
  if (action === 'fill' && el instanceof HTMLSelectElement) {
    el.focus();
    el.value = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (action === 'fill' && el.isContentEditable) {
    el.focus();
    el.textContent = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
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

function waitForDomTick(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
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
  const isDockVisible =
    (!!user || location.pathname === '/login') && !loading && isVoiceAgentEnabled();

  const runIntent = useCallback(
    async (intent: VoiceIntent): Promise<UndoFn | null> => {
      const undo = buildUndoBeforeIntent(intent, locationRef.current, navigate);

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
            return null;
          }
        }
      }

      setAgentState('acting');
      setLastIntentSummary(intent.type);

      switch (intent.type) {
        case 'navigate': {
          const search = intent.query ? `?${new URLSearchParams(intent.query).toString()}` : '';
          navigate({ pathname: intent.path, search });
          taskTracker.recordStep();
          speakReason(intent.reason);
          break;
        }
        case 'set_query': {
          const loc = locationRef.current;
          const sp = new URLSearchParams(loc.search.replace(/^\?/, ''));
          for (const [k, v] of Object.entries(intent.query)) {
            sp.set(k, v);
          }
          navigate({ pathname: loc.pathname, search: sp.toString() ? `?${sp.toString()}` : '' });
          taskTracker.recordStep();
          speakReason(intent.reason);
          break;
        }
        case 'action': {
          mergeVisibleVoiceTargets();
          const entry = voiceTargetRegistry.get(intent.target_id);
          const safe = intent.target_id.replace(/"/g, '\\"');
          const el = document.querySelector<HTMLElement>(`[data-voice-target="${safe}"]`);
          const inferred = el ? inferActionForElement(el) : 'click';
          let action: VoiceTargetAction = entry?.action ?? inferred;
          const hasValue = intent.value != null && String(intent.value).length > 0;
          if (hasValue && inferred === 'fill') action = 'fill';
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

      const locAfter = locationRef.current;
      let pathAfter = locAfter.pathname;
      let searchAfter = locAfter.search;
      if (intent.type === 'navigate') {
        pathAfter = intent.path;
        searchAfter = intent.query ? `?${new URLSearchParams(intent.query).toString()}` : '';
      } else if (intent.type === 'set_query') {
        const sp = new URLSearchParams(locAfter.search.replace(/^\?/, ''));
        for (const [k, v] of Object.entries(intent.query)) {
          sp.set(k, v);
        }
        searchAfter = sp.toString() ? `?${sp.toString()}` : '';
      }

      const visibleIds = new Set(mergeVisibleVoiceTargets().map((t) => t.id));
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

      return undo;
    },
    [navigate]
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

      if (matchesVoiceUndoCommand(trimmed)) {
        if (voiceUndoStack.undoLast()) {
          maybeSpeak('Undid that.');
        } else {
          maybeSpeak('Nothing to undo.');
        }
        setAgentState('idle');
        return;
      }

      processingRef.current = true;
      setAgentState('thinking');
      setLastError(null);

      try {
        const visibleTargets = mergeVisibleVoiceTargets();
        const currentNodeId = findNodeId(location.pathname, location.search);
        const uiMapPrompt = buildUiMapForPrompt(currentNodeId, {
          isAuthenticated: !!user,
          isAdmin,
        });
        const intentResult: VoiceIntentResult = await postVoiceIntentForUser(
          {
            transcript: trimmed,
            context: {
              pathname: location.pathname,
              search: location.search,
              isAuthenticated: !!user,
              isAdmin,
              visibleTargets,
              currentNodeId,
              activeGoal: taskTracker.getActiveGoalContext(),
            },
            uiMapPrompt,
          },
          !!user
        );

        const steps: VoiceIntent[] = isVoiceIntentBatch(intentResult)
          ? intentResult.steps
          : [intentResult];

        const undoOps: UndoFn[] = [];
        for (let i = 0; i < steps.length; i++) {
          const op = await runIntent(steps[i]!);
          if (op) undoOps.push(op);
          if (i < steps.length - 1) {
            await waitForDomTick();
            const prev = steps[i]!;
            if (prev.type === 'navigate' || prev.type === 'set_query') {
              await new Promise<void>((r) => setTimeout(r, 60));
            }
          }
        }
        voiceUndoStack.pushGroup(undoOps);

        if (isVoiceIntentBatch(intentResult)) {
          setLastIntentSummary('batch');
        }
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
