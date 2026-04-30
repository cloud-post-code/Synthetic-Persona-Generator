export type VoiceBusEvent =
  | { type: 'voice:action'; targetId: string; action: 'click' | 'focus' | 'fill'; value?: string }
  | { type: 'persona:saved' }
  | { type: 'business_profile:saved' }
  | { type: 'voice:plan:start'; planId: string; totalSteps: number; transcript: string }
  | { type: 'voice:plan:step'; planId: string; stepIndex: number; totalSteps: number; description: string }
  | { type: 'voice:plan:replan'; planId: string; cursor: number; totalSteps: number; reason?: string }
  | { type: 'voice:plan:done'; planId: string }
  | { type: 'voice:plan:cancelled'; planId: string; reason?: string }
  | { type: 'voice:plan:failed'; planId: string; reason?: string };

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
