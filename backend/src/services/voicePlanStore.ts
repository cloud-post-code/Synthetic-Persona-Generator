/**
 * In-memory plan store for the navigator agent. Hidden behind the
 * `PlanStore` interface so we can swap to a `voice_plan_runs` table later
 * without touching the controller / planner layer.
 *
 * Records are keyed by `planId` (a uuid v4) and expire after `TTL_MS` of
 * inactivity. Touched whenever the plan is read or updated.
 */

import { randomUUID } from 'crypto';
import type { VoiceIntent } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';

export type PlanStatus = 'active' | 'done' | 'cancelled' | 'failed';

export type PlanObservation = {
  stepIndex: number;
  pathname?: string;
  currentNodeId?: string | null;
  visibleTargetIds?: string[];
  /** Free-form summary of what the executor saw / errors raised. */
  summary?: string;
  validationError?: string | null;
  matched?: boolean;
  ok?: boolean;
};

export type PlanRecord = {
  planId: string;
  userId: string | null;
  transcript: string;
  steps: VoiceIntent[];
  /** Original request envelope (uiMapPrompt + initial context), used for replans. */
  request: VoiceIntentRequest;
  status: PlanStatus;
  cursor: number;
  replans: number;
  createdAt: number;
  updatedAt: number;
  observations: PlanObservation[];
  /** Concatenated history of step outputs / replans, for telemetry. */
  history: { kind: 'created' | 'observed' | 'replanned' | 'completed' | 'cancelled' | 'failed'; at: number; detail?: string }[];
};

export interface PlanStore {
  create(input: Omit<PlanRecord, 'planId' | 'createdAt' | 'updatedAt' | 'observations' | 'history' | 'cursor' | 'replans' | 'status'> & { status?: PlanStatus }): PlanRecord;
  get(planId: string): PlanRecord | null;
  update(planId: string, mut: (rec: PlanRecord) => void): PlanRecord | null;
  cancel(planId: string): boolean;
  cleanup(): void;
}

const TTL_MS = 5 * 60 * 1000;

class InMemoryPlanStore implements PlanStore {
  private readonly map = new Map<string, PlanRecord>();
  private lastSweep = 0;

  create(
    input: Omit<PlanRecord, 'planId' | 'createdAt' | 'updatedAt' | 'observations' | 'history' | 'cursor' | 'replans' | 'status'> & { status?: PlanStatus }
  ): PlanRecord {
    this.maybeSweep();
    const now = Date.now();
    const planId = randomUUID();
    const rec: PlanRecord = {
      planId,
      userId: input.userId,
      transcript: input.transcript,
      steps: input.steps,
      request: input.request,
      status: input.status ?? 'active',
      cursor: 0,
      replans: 0,
      createdAt: now,
      updatedAt: now,
      observations: [],
      history: [{ kind: 'created', at: now, detail: `${input.steps.length} steps` }],
    };
    this.map.set(planId, rec);
    return rec;
  }

  get(planId: string): PlanRecord | null {
    this.maybeSweep();
    const rec = this.map.get(planId) || null;
    if (!rec) return null;
    if (this.isExpired(rec)) {
      this.map.delete(planId);
      return null;
    }
    rec.updatedAt = Date.now();
    return rec;
  }

  update(planId: string, mut: (rec: PlanRecord) => void): PlanRecord | null {
    const rec = this.get(planId);
    if (!rec) return null;
    mut(rec);
    rec.updatedAt = Date.now();
    this.map.set(planId, rec);
    return rec;
  }

  cancel(planId: string): boolean {
    const rec = this.get(planId);
    if (!rec) return false;
    rec.status = 'cancelled';
    rec.history.push({ kind: 'cancelled', at: Date.now() });
    rec.updatedAt = Date.now();
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, rec] of this.map.entries()) {
      if (now - rec.updatedAt > TTL_MS) this.map.delete(id);
    }
    this.lastSweep = now;
  }

  private isExpired(rec: PlanRecord): boolean {
    return Date.now() - rec.updatedAt > TTL_MS;
  }

  private maybeSweep(): void {
    const now = Date.now();
    if (now - this.lastSweep > 30_000) this.cleanup();
  }
}

let storeInstance: PlanStore | null = null;

export function planStore(): PlanStore {
  if (!storeInstance) storeInstance = new InMemoryPlanStore();
  return storeInstance;
}

export const PLAN_TTL_MS = TTL_MS;
