export type VoiceBusEvent =
  | { type: 'voice:action'; targetId: string; action: 'click' | 'focus' | 'fill'; value?: string }
  | { type: 'persona:saved' }
  | { type: 'business_profile:saved' };

type Listener = (e: VoiceBusEvent) => void;

const listeners = new Set<Listener>();

export const commandBus = {
  emit(event: VoiceBusEvent) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.error('[commandBus]', e);
      }
    });
  },
  on(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
