import type { ActiveGoalContext, CompletionSignal } from './intents.js';
import { commandBus, type VoiceBusEvent } from './commandBus.js';
import { UI_NODES, getNodeById } from './uiMap.js';

const DEFAULT_MAX_STEPS = 6;
const DEFAULT_STEP_TIMEOUT_MS = 20_000;

type ActiveGoal = {
  goalId: string;
  nodeId: string;
  description: string;
  completion: CompletionSignal;
  stepsTaken: number;
  maxSteps: number;
  startedAt: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

let active: ActiveGoal | null = null;
let stepListeners: Array<(g: ActiveGoal | null) => void> = [];

function notify() {
  stepListeners.forEach((fn) => fn(active));
}

function clearTimeoutIfAny() {
  if (active?.timeoutId) {
    clearTimeout(active.timeoutId);
    active.timeoutId = null;
  }
}

function findGoal(goalId: string): { nodeId: string; goal: { id: string; description: string; completion: CompletionSignal } } | null {
  for (const node of UI_NODES) {
    const g = node.goals.find((x) => x.id === goalId);
    if (g) return { nodeId: node.id, goal: g };
  }
  return null;
}

export const taskTracker = {
  subscribe(fn: (g: ActiveGoal | null) => void) {
    stepListeners.push(fn);
    return () => {
      stepListeners = stepListeners.filter((x) => x !== fn);
    };
  },

  start(goalId: string): boolean {
    const found = findGoal(goalId);
    if (!found) return false;
    clearTimeoutIfAny();
    active = {
      goalId: found.goal.id,
      nodeId: found.nodeId,
      description: found.goal.description,
      completion: found.goal.completion,
      stepsTaken: 0,
      maxSteps: DEFAULT_MAX_STEPS,
      startedAt: Date.now(),
      timeoutId: null,
    };
    active.timeoutId = setTimeout(() => {
      if (active?.goalId === goalId) {
        clearTimeoutIfAny();
        active = null;
        notify();
      }
    }, DEFAULT_STEP_TIMEOUT_MS);
    notify();
    return true;
  },

  recordStep() {
    if (!active) return;
    active.stepsTaken += 1;
    clearTimeoutIfAny();
    if (active.stepsTaken >= active.maxSteps) {
      active = null;
      notify();
      return;
    }
    active.timeoutId = setTimeout(() => {
      active = null;
      notify();
    }, DEFAULT_STEP_TIMEOUT_MS);
    notify();
  },

  getActiveGoalContext(): ActiveGoalContext | null {
    if (!active) return null;
    return {
      goalId: active.goalId,
      description: active.description,
      completion: active.completion,
      stepsTaken: active.stepsTaken,
      maxSteps: active.maxSteps,
      startedAt: active.startedAt,
    };
  },

  complete(goalId: string) {
    if (!active || active.goalId !== goalId) return;
    clearTimeoutIfAny();
    active = null;
    notify();
  },

  cancel() {
    clearTimeoutIfAny();
    active = null;
    notify();
  },

  /** Returns true if completion signal matches current route / event / visible target */
  checkCompletion(params: {
    pathname: string;
    search: string;
    visibleTargetIds: Set<string>;
    event?: VoiceBusEvent;
  }): boolean {
    if (!active) return false;
    const c = active.completion;
    if (c.type === 'event' && params.event) {
      if (params.event.type === c.name) return true;
    }
    if (c.type === 'route') {
      const pathOk = params.pathname === c.path || params.pathname.startsWith(c.path + '/');
      if (!pathOk) return false;
      if (c.query) {
        const sp = new URLSearchParams(params.search.replace(/^\?/, ''));
        for (const [k, v] of Object.entries(c.query)) {
          if (sp.get(k) !== v) return false;
        }
      }
      return true;
    }
    if (c.type === 'target_visible') {
      return params.visibleTargetIds.has(c.target_id);
    }
    if (c.type === 'predicate') {
      return false;
    }
    return false;
  },

  /** Whether intent path/query is allowed as a deviation from active goal's node graph */
  intentAllowedForActiveGoal(intentPath: string, intentQuery?: Record<string, string>): boolean {
    if (!active) return true;
    const node = getNodeById(active.nodeId);
    if (!node) return true;
    for (const t of node.transitions) {
      const target = getNodeById(t.to);
      if (!target) continue;
      if (target.path !== intentPath) continue;
      if (intentQuery && target.query) {
        let ok = true;
        for (const [k, v] of Object.entries(target.query)) {
          if ((intentQuery[k] || '') !== v) ok = false;
        }
        if (!ok) continue;
      } else if (target.query && !intentQuery) {
        continue;
      }
      return true;
    }
    if (node.path === intentPath) {
      if (!intentQuery && !node.query) return true;
      if (node.query && intentQuery) {
        return Object.entries(node.query).every(([k, v]) => (intentQuery[k] || '') === v);
      }
    }
    return false;
  },
};

/** Wire persona saved etc. */
export function initTaskTrackerBus() {
  return commandBus.on((e) => {
    if (!active) return;
    if (active.completion.type === 'event' && e.type === active.completion.name) {
      clearTimeoutIfAny();
      active = null;
      notify();
    }
  });
}
