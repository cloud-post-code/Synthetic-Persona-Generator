import React, { useEffect, useRef } from 'react';
import type { VoiceTargetAction } from './intents.js';
import { voiceTargetRegistry } from './voiceTargetRegistry.js';

export type UseVoiceTargetOptions = {
  id: string;
  label: string;
  action: VoiceTargetAction;
  /** Optional ref; if omitted, creates internal ref (must forward to DOM) */
  ref?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
};

/**
 * Registers a voice-navigable control. Sets `data-voice-target` on the element for debugging.
 */
export function useVoiceTarget(options: UseVoiceTargetOptions) {
  const { id, label, action, ref: externalRef, enabled = true } = options;
  const internalRef = useRef<HTMLElement | null>(null);
  const ref = externalRef ?? internalRef;
  useEffect(() => {
    if (!enabled) return;
    voiceTargetRegistry.register({ id, label, action });
    const el = ref.current;
    if (el) {
      el.setAttribute('data-voice-target', id);
      el.setAttribute('aria-label', label);
    }
    return () => {
      voiceTargetRegistry.unregister(id);
      if (el) {
        el.removeAttribute('data-voice-target');
      }
    };
  }, [id, label, action, enabled, ref]);

  return ref;
}
