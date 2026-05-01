import type { NormalizedGeminiUsage } from '../utils/geminiUsage.js';
import { mergeUsage } from '../utils/geminiUsage.js';

export const TOKEN_USAGE_STORAGE_KEY = 'instinct_token_usage_v1';

export type TokenUsageBucket =
  | 'build_simulation'
  | 'run_simulation'
  | 'build_personas'
  | 'business_profile'
  | 'voice_agent';

export const TOKEN_USAGE_BUCKET_LABELS: Record<TokenUsageBucket, string> = {
  build_simulation: 'Build simulation',
  run_simulation: 'Run simulation',
  build_personas: 'Build personas',
  business_profile: 'Business profile',
  voice_agent: 'Voice agent',
};

export type TokenUsageSnapshot = Record<
  TokenUsageBucket,
  { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
>;

const BUCKETS: TokenUsageBucket[] = [
  'build_simulation',
  'run_simulation',
  'build_personas',
  'business_profile',
  'voice_agent',
];

function emptySnapshot(): TokenUsageSnapshot {
  const o = {} as TokenUsageSnapshot;
  for (const b of BUCKETS) {
    o[b] = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  }
  return o;
}

function parseStored(raw: string | null): TokenUsageSnapshot {
  const snap = emptySnapshot();
  if (!raw) return snap;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (!j || typeof j !== 'object') return snap;
    for (const b of BUCKETS) {
      const v = j[b];
      if (v && typeof v === 'object' && v !== null) {
        const r = v as Record<string, unknown>;
        snap[b] = {
          promptTokenCount: Math.max(0, Math.floor(Number(r.promptTokenCount) || 0)),
          candidatesTokenCount: Math.max(0, Math.floor(Number(r.candidatesTokenCount) || 0)),
          totalTokenCount: Math.max(0, Math.floor(Number(r.totalTokenCount) || 0)),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return snap;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('instinct-token-usage'));
  }
}

function read(): TokenUsageSnapshot {
  if (typeof localStorage === 'undefined') return emptySnapshot();
  return parseStored(localStorage.getItem(TOKEN_USAGE_STORAGE_KEY));
}

function write(snap: TokenUsageSnapshot) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_USAGE_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

export const tokenUsageStore = {
  getSnapshot(): TokenUsageSnapshot {
    return read();
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_USAGE_STORAGE_KEY) fn();
    };
    const onCustom = () => fn();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      window.addEventListener('instinct-token-usage', onCustom);
    }
    return () => {
      listeners.delete(fn);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('instinct-token-usage', onCustom);
      }
    };
  },

  addUsage(bucket: TokenUsageBucket, delta: NormalizedGeminiUsage | null | undefined): void {
    if (!delta) return;
    const snap = read();
    const cur = snap[bucket];
    const merged = mergeUsage(cur, delta);
    snap[bucket] = merged;
    write(snap);
    emit();
  },

  reset(): void {
    write(emptySnapshot());
    emit();
  },

  grandTotal(snap: TokenUsageSnapshot): number {
    let t = 0;
    for (const b of BUCKETS) t += snap[b].totalTokenCount;
    return t;
  },

  buckets(): readonly TokenUsageBucket[] {
    return BUCKETS;
  },
};
