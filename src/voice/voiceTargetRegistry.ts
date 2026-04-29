import type { VoiceTargetEntry } from './intents.js';

const targets = new Map<string, VoiceTargetEntry>();

export const voiceTargetRegistry = {
  register(entry: VoiceTargetEntry) {
    targets.set(entry.id, entry);
  },
  unregister(id: string) {
    targets.delete(id);
  },
  get(id: string): VoiceTargetEntry | undefined {
    return targets.get(id);
  },
  list(): VoiceTargetEntry[] {
    return Array.from(targets.values());
  },
  clear() {
    targets.clear();
  },
};
