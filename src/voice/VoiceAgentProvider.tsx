/**
 * Global voice navigator (context + /voice/plan). Not mounted — see src/App.tsx (VoiceAgentProvider commented out).
 * To restore: uncomment VoiceAgentProvider import and wrap the Router tree; render VoiceAgentDock inside the provider.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { commandBus } from './commandBus.js';
import { buildUiMapForPrompt, findNodeId } from './uiMap.js';
import { initTaskTrackerBus, taskTracker } from './taskTracker.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';
import type { VoiceIntent, VoiceIntentRequestBody, VoiceTargetAction } from './intents.js';
import {
  postVoiceCancel,
  postVoiceIntentForUser,
  postVoiceObserve,
  postVoicePlan,
  type VoiceObservationBody,
} from './voiceApi.js';
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
  const activePlanIdRef = useRef<string | null>(null);
  const cancelRequestedRef = useRef(false);

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
    async (intent: VoiceIntent): Promise<{ undo: UndoFn | null; ok: boolean; error?: string }> => {
      const undo = buildUndoBeforeIntent(intent, locationRef.current, navigate);

      const speakReason = (reason?: string) => {
        if (reason && isVoiceTtsEnabled()) maybeSpeak(reason);
      };

      const intentGoalId =
        intent.type === 'navigate' || intent.type === 'set_query' || intent.type === 'action'
          ? intent.goalId
          : undefined;
      if (intentGoalId && !taskTracker.getActiveGoalContext()) {
        taskTracker.start(intentGoalId);
      }

      const activeGoal = taskTracker.getActiveGoalContext();
      if (activeGoal && intent.type !== 'goal_complete' && intent.type !== 'speak' && intent.type !== 'clarify' && intent.type !== 'unsupported') {
        if (intent.type === 'navigate') {
          const allowed = taskTracker.intentAllowedForActiveGoal(intent.path, intent.query);
          if (!allowed) {
            maybeSpeak('That would take us off the current task. Say cancel to stop the task.');
            setAgentState('idle');
            return { undo: null, ok: false, error: 'navigate-off-task' };
          }
        }
      }

      setAgentState('acting');
      setLastIntentSummary(intent.type);

      let stepOk = true;
      let stepErr: string | undefined;

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
          const dispatched = executeDomAction(intent.target_id, action, intent.value);
          if (!dispatched) {
            stepOk = false;
            stepErr = `target ${intent.target_id} not found`;
            maybeSpeak('Could not run that action.');
          }
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
          stepOk = false;
          stepErr = intent.reason;
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

      return { undo, ok: stepOk, error: stepErr };
    },
    [navigate]
  );

  const buildRequestBody = useCallback(
    (transcript: string): VoiceIntentRequestBody => {
      const visibleTargets = mergeVisibleVoiceTargets();
      const loc = locationRef.current;
      const currentNodeId = findNodeId(loc.pathname, loc.search);
      const uiMapPrompt = buildUiMapForPrompt(currentNodeId, {
        isAuthenticated: !!user,
        isAdmin,
      });
      return {
        transcript,
        context: {
          pathname: loc.pathname,
          search: loc.search,
          isAuthenticated: !!user,
          isAdmin,
          visibleTargets,
          currentNodeId,
          activeGoal: taskTracker.getActiveGoalContext(),
        },
        uiMapPrompt,
      };
    },
    [user, isAdmin]
  );

  /** Execute one step and return an Observation to ship back to /observe. */
  const executeStepWithObservation = useCallback(
    async (step: VoiceIntent, stepIndex: number): Promise<{ obs: VoiceObservationBody['observation']; undo: UndoFn | null }> => {
      let lastValidationError: string | null = null;
      const offBus = commandBus.on((evt) => {
        if (evt.type === 'voice:action' && evt.value === '__VALIDATION_ERROR__') {
          lastValidationError = `Validation error on ${evt.targetId}`;
        }
      });

      const { undo, ok, error } = await runIntent(step);
      await waitForDomTick();
      if (step.type === 'navigate' || step.type === 'set_query') {
        await new Promise<void>((r) => setTimeout(r, 80));
      }

      const loc = locationRef.current;
      const visible = mergeVisibleVoiceTargets();
      const currentNodeId = findNodeId(loc.pathname, loc.search);

      let matched = ok;
      if (step.type === 'navigate') {
        matched = matched && loc.pathname === step.path;
      } else if (step.type === 'action') {
        // Re-check the target appeared at all on the new screen.
        matched = matched && visible.some((v) => v.id === step.target_id);
      }

      offBus();

      const obs: VoiceObservationBody['observation'] = {
        stepIndex,
        pathname: loc.pathname,
        currentNodeId: currentNodeId ?? null,
        visibleTargetIds: visible.slice(0, 30).map((v) => v.id),
        matched,
        ok,
        validationError: lastValidationError ?? (error ?? null),
        summary: error
          ? error
          : step.type === 'navigate'
          ? `Navigated to ${step.path}`
          : step.type === 'set_query'
          ? `Set query ${JSON.stringify(step.query)}`
          : step.type === 'action'
          ? `Action ${step.target_id}${step.value ? ' (with value)' : ''}`
          : step.type,
      };
      return { obs, undo };
    },
    [runIntent]
  );

  const stepDescription = (step: VoiceIntent): string => {
    if (step.type === 'navigate') return `Navigating to ${step.path}`;
    if (step.type === 'set_query') return `Switching tab ${JSON.stringify(step.query)}`;
    if (step.type === 'action') return `Filling ${step.target_id}`;
    if (step.type === 'speak') return 'Speaking';
    if (step.type === 'clarify') return 'Clarifying';
    if (step.type === 'goal_complete') return 'Completing task';
    return step.type;
  };

  const fallbackToLegacy = useCallback(
    async (transcript: string): Promise<void> => {
      const body = buildRequestBody(transcript);
      const intentResult = await postVoiceIntentForUser(body, !!user);
      const steps: VoiceIntent[] = intentResult.type === 'batch' ? intentResult.steps : [intentResult];
      const undoOps: UndoFn[] = [];
      for (let i = 0; i < steps.length; i++) {
        const { undo } = await runIntent(steps[i]!);
        if (undo) undoOps.push(undo);
        if (i < steps.length - 1) {
          await waitForDomTick();
          const prev = steps[i]!;
          if (prev.type === 'navigate' || prev.type === 'set_query') {
            await new Promise<void>((r) => setTimeout(r, 60));
          }
        }
      }
      voiceUndoStack.pushGroup(undoOps);
    },
    [buildRequestBody, runIntent, user]
  );

  const processFinalTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;
      const lower = trimmed.toLowerCase();
      if (/\b(stop|cancel|never mind)\b/i.test(lower)) {
        cancelRequestedRef.current = true;
        if (activePlanIdRef.current) {
          const planId = activePlanIdRef.current;
          void postVoiceCancel(planId).catch(() => undefined);
          commandBus.emit({ type: 'voice:plan:cancelled', planId, reason: 'user cancelled' });
          activePlanIdRef.current = null;
        }
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
      cancelRequestedRef.current = false;
      setAgentState('thinking');
      setLastError(null);

      try {
        if (!user) {
          // Public path keeps using the legacy single-shot endpoint; the new
          // /plan + /observe loop requires JWT.
          await fallbackToLegacy(trimmed);
          return;
        }

        const initialBody = buildRequestBody(trimmed);
        let planResp;
        try {
          planResp = await postVoicePlan(initialBody);
        } catch (err) {
          console.warn('[voice.plan] /plan failed, falling back to legacy /intent', err);
          await fallbackToLegacy(trimmed);
          return;
        }

        if (planResp.kind === 'inline') {
          // If the planner produced an `unsupported` shape, give the legacy
          // single-shot planner (with its template/keyword fallbacks) a chance
          // before giving up.
          if (planResp.result.type === 'unsupported') {
            await fallbackToLegacy(trimmed);
            return;
          }
          const undoOps: UndoFn[] = [];
          const { undo } = await runIntent(planResp.result);
          if (undo) undoOps.push(undo);
          voiceUndoStack.pushGroup(undoOps);
          return;
        }

        if (planResp.kind === 'fallback') {
          // Backend signaled GEMINI is unavailable -> legacy rule-based.
          const undoOps: UndoFn[] = [];
          const { undo } = await runIntent(planResp.result);
          if (undo) undoOps.push(undo);
          voiceUndoStack.pushGroup(undoOps);
          return;
        }

        const planId = planResp.planId;
        let steps = planResp.steps;
        let cursor = 0;
        const totalAtStart = steps.length;
        activePlanIdRef.current = planId;
        commandBus.emit({
          type: 'voice:plan:start',
          planId,
          totalSteps: steps.length,
          transcript: trimmed,
        });
        setLastIntentSummary(`plan(${steps.length})`);

        const undoOps: UndoFn[] = [];
        let safetyHops = 0;
        const MAX_HOPS = totalAtStart * 4 + 24;

        while (cursor < steps.length) {
          if (cancelRequestedRef.current) break;
          if (safetyHops++ > MAX_HOPS) {
            setLastError('Plan exceeded safety hop budget.');
            commandBus.emit({ type: 'voice:plan:failed', planId, reason: 'hop budget exceeded' });
            break;
          }
          const stepIndex = cursor;
          const step = steps[stepIndex]!;
          commandBus.emit({
            type: 'voice:plan:step',
            planId,
            stepIndex,
            totalSteps: steps.length,
            description: stepDescription(step),
          });

          const { obs, undo } = await executeStepWithObservation(step, stepIndex);
          if (undo) undoOps.push(undo);

          if (cancelRequestedRef.current) break;

          let obsResp;
          try {
            obsResp = await postVoiceObserve({
              planId,
              observation: obs,
              latestContext: buildRequestBody(trimmed).context,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastError(msg);
            commandBus.emit({ type: 'voice:plan:failed', planId, reason: msg });
            break;
          }

          if (obsResp.action === 'continue') {
            cursor = Math.max(cursor + 1, obsResp.cursor);
            continue;
          }
          if (obsResp.action === 'replan') {
            commandBus.emit({
              type: 'voice:plan:replan',
              planId,
              cursor: obsResp.cursor,
              totalSteps: steps.length,
              reason: obsResp.reason,
            });
            steps = [...steps.slice(0, obsResp.cursor), ...obsResp.steps];
            cursor = obsResp.cursor;
            // Inline clarify/speak/unsupported single-step replan = run and stop.
            if (obsResp.steps.length === 1 && (obsResp.steps[0]!.type === 'clarify' || obsResp.steps[0]!.type === 'speak' || obsResp.steps[0]!.type === 'unsupported')) {
              const { undo: u2 } = await runIntent(obsResp.steps[0]!);
              if (u2) undoOps.push(u2);
              break;
            }
            continue;
          }
          if (obsResp.action === 'done') {
            commandBus.emit({ type: 'voice:plan:done', planId });
            break;
          }
          if (obsResp.action === 'cancelled') {
            commandBus.emit({ type: 'voice:plan:cancelled', planId, reason: obsResp.reason });
            break;
          }
          if (obsResp.action === 'failed') {
            commandBus.emit({ type: 'voice:plan:failed', planId, reason: obsResp.reason });
            setLastError(obsResp.reason || 'Plan failed.');
            break;
          }
        }

        voiceUndoStack.pushGroup(undoOps);
        if (cursor >= steps.length && !cancelRequestedRef.current) {
          commandBus.emit({ type: 'voice:plan:done', planId });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed.';
        setLastError(msg);
        maybeSpeak('Sorry, something went wrong.');
        setAgentState('idle');
        if (activePlanIdRef.current) {
          commandBus.emit({ type: 'voice:plan:failed', planId: activePlanIdRef.current, reason: msg });
        }
      } finally {
        if (activePlanIdRef.current) activePlanIdRef.current = null;
        processingRef.current = false;
      }
    },
    [user, buildRequestBody, executeStepWithObservation, fallbackToLegacy, runIntent]
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
