import type { VoiceTargetAction, VoiceTargetEntry } from './intents.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';

const AUTO_PREFIX = 'voice.auto.';
export const VOICE_EXCLUDE_ATTR = 'data-voice-exclude';
/** Max merged registry + scanned targets sent to the intent API */
export const MAX_VISIBLE_VOICE_TARGETS = 100;

function isExcluded(el: Element): boolean {
  return !!el.closest(`[${VOICE_EXCLUDE_ATTR}]`);
}

function isVisible(he: HTMLElement): boolean {
  if (isExcluded(he)) return false;
  const st = window.getComputedStyle(he);
  if (st.display === 'none' || st.visibility === 'hidden') return false;
  const r = he.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return false;
  return true;
}

export function inferActionForElement(el: HTMLElement): VoiceTargetAction {
  if (el instanceof HTMLSelectElement) return 'fill';
  if (el instanceof HTMLTextAreaElement) return 'fill';
  if (el.isContentEditable) return 'fill';
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    if (t === 'hidden' || t === 'file') return 'click';
    if (['text', 'email', 'password', 'search', 'url', 'tel', 'number'].includes(t)) return 'fill';
    return 'click';
  }
  return 'click';
}

function getControlLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const ls = el.labels;
    if (ls && ls.length > 0) {
      const t = ls[0].textContent?.trim();
      if (t) return t;
    }
    const ph = el.getAttribute('placeholder');
    if (ph?.trim()) return ph.trim();
    const name = el.getAttribute('name');
    if (name?.trim()) return name.trim();
    if (el.id) return el.id;
  }
  if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) {
    const tx = el.textContent?.trim();
    if (tx) return tx.slice(0, 80);
  }
  return 'Control';
}

/** Remove auto-assigned targets from previous scan */
export function cleanupStaleAutoVoiceTargets(): void {
  document.querySelectorAll(`[data-voice-target^="${AUTO_PREFIX}"]`).forEach((el) => {
    el.removeAttribute('data-voice-target');
  });
}

type Sortable = { el: HTMLElement; order: number };

/**
 * Scan DOM for fillable/clickable controls not already registered via useVoiceTarget.
 * Assigns data-voice-target="voice.auto.N" and returns entries (registry merged separately).
 */
export function scanVisibleVoiceTargets(): VoiceTargetEntry[] {
  const selector =
    'input, textarea, select, button, a[href], [contenteditable="true"]';
  const all = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

  const active = document.activeElement as HTMLElement | null;
  const sortable: Sortable[] = [];
  const explicit: { el: HTMLElement; id: string }[] = [];
  const registeredIds = new Set(voiceTargetRegistry.list().map((t) => t.id));
  let order = 0;
  for (const el of all) {
    if (!(el instanceof HTMLElement)) continue;
    if (!isVisible(el)) continue;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || '').toLowerCase();
      if (t === 'hidden') continue;
    }
    const existing = el.getAttribute('data-voice-target');
    if (existing && !existing.startsWith(AUTO_PREFIX)) {
      // Only surface explicit tags that aren't already in the registry, so the
      // planner can still address them by their schema-driven id.
      if (!registeredIds.has(existing)) {
        explicit.push({ el, id: existing });
      }
      continue;
    }

    sortable.push({
      el,
      order: active && el === active ? -1 : order++,
    });
  }

  sortable.sort((a, b) => a.order - b.order);

  const out: VoiceTargetEntry[] = [];

  for (const { el, id } of explicit) {
    if (out.length >= MAX_VISIBLE_VOICE_TARGETS) break;
    out.push({
      id,
      label: getControlLabel(el),
      action: inferActionForElement(el),
    });
  }

  let counter = 0;
  const regCount = voiceTargetRegistry.list().length;
  const budget = Math.max(0, MAX_VISIBLE_VOICE_TARGETS - regCount - out.length);

  for (const { el } of sortable) {
    if (out.length - explicit.length >= budget) break;
    const id = `${AUTO_PREFIX}${counter++}`;
    el.setAttribute('data-voice-target', id);
    out.push({
      id,
      label: getControlLabel(el),
      action: inferActionForElement(el),
    });
  }

  return out;
}

/** Registry first (explicit targets), then auto-scanned; capped */
export function mergeVisibleVoiceTargets(): VoiceTargetEntry[] {
  cleanupStaleAutoVoiceTargets();
  const registered = voiceTargetRegistry.list();
  const scanned = scanVisibleVoiceTargets();
  const seen = new Set<string>();
  const merged: VoiceTargetEntry[] = [];
  for (const t of registered) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
  }
  for (const t of scanned) {
    if (merged.length >= MAX_VISIBLE_VOICE_TARGETS) break;
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
  }
  return merged;
}
