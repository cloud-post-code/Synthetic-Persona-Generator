import type { NavigateFunction } from 'react-router-dom';
import type { VoiceIntent, VoiceTargetAction } from './intents.js';
import { inferActionForElement, mergeVisibleVoiceTargets } from './scanVisibleVoiceTargets.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';

export type UndoFn = () => void;

const MAX_GROUPS = 15;
const groups: UndoFn[][] = [];

/** Voice phrases that trigger undo (exact match after trim + strip trailing punctuation). */
const UNDO_PHRASES = new Set([
  'undo',
  'undo that',
  'undo last',
  'reverse that',
  'take that back',
  'reverse last',
]);

export function matchesVoiceUndoCommand(trimmed: string): boolean {
  const t = trimmed
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .trim();
  return UNDO_PHRASES.has(t);
}

export const voiceUndoStack = {
  /** One utterance (including batch) = one group; ops run in reverse order on undo. */
  pushGroup(ops: UndoFn[]): void {
    const filtered = ops.filter(Boolean);
    if (!filtered.length) return;
    groups.push(filtered);
    while (groups.length > MAX_GROUPS) groups.shift();
  },

  undoLast(): boolean {
    const g = groups.pop();
    if (!g?.length) return false;
    for (let i = g.length - 1; i >= 0; i--) {
      try {
        g[i]!();
      } catch {
        /* best-effort */
      }
    }
    return true;
  },

  clear(): void {
    groups.length = 0;
  },
};

type Loc = { pathname: string; search: string };

/**
 * Snapshot before a voice intent runs. Returns null if there is nothing reversible
 * (e.g. speak, click-only, or unsupported).
 */
export function buildUndoBeforeIntent(
  intent: VoiceIntent,
  loc: Loc,
  navigate: NavigateFunction
): UndoFn | null {
  switch (intent.type) {
    case 'navigate': {
      const p = loc.pathname;
      const s = loc.search;
      return () => navigate({ pathname: p, search: s });
    }
    case 'set_query': {
      const p = loc.pathname;
      const s = loc.search;
      return () => navigate({ pathname: p, search: s });
    }
    case 'action': {
      mergeVisibleVoiceTargets();
      const safe = intent.target_id.replace(/"/g, '\\"');
      const el = document.querySelector<HTMLElement>(`[data-voice-target="${safe}"]`);
      if (!el) return null;
      const entry = voiceTargetRegistry.get(intent.target_id);
      const inferred = inferActionForElement(el);
      let action: VoiceTargetAction = entry?.action ?? inferred;
      const hasValue = intent.value != null && String(intent.value).length > 0;
      if (hasValue && inferred === 'fill') action = 'fill';
      if (action !== 'fill') return null;

      if (el instanceof HTMLSelectElement) {
        const prev = el.value;
        return () => {
          el.value = prev;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
      }
      if (el.isContentEditable) {
        const prev = el.textContent ?? '';
        return () => {
          el.textContent = prev;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const prev = el.value;
        return () => {
          el.value = prev;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
      }
      return null;
    }
    default:
      return null;
  }
}
