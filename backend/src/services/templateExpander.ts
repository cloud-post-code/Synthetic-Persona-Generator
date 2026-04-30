import type { VoiceIntent } from '../types/voiceIntents.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import type { IntentTemplate, SlotPlaceholder, TemplateStep } from '../voice/intentTemplates.js';
import { getNodeById } from '../voice/uiMapData.js';
import { resolveByName } from './userDataContext.js';

export type ExpandResult =
  | { kind: 'ok'; steps: VoiceIntent[] }
  | { kind: 'clarify'; intent: Extract<VoiceIntent, { type: 'clarify' }> }
  | { kind: 'unsupported'; reason: string };

function isSlotPh(v: string | SlotPlaceholder): v is SlotPlaceholder {
  return typeof v === 'object' && v !== null && 'slot' in v;
}

function substituteString(v: string | SlotPlaceholder, slots: Record<string, string>): string {
  if (isSlotPh(v)) {
    return slots[v.slot] ?? '';
  }
  return v;
}

function findTargetByPattern(
  pattern: string,
  targets: VoiceIntentRequest['context']['visibleTargets'],
): string | undefined {
  const p = pattern.toLowerCase();
  let best: { id: string; score: number } | undefined;
  for (const t of targets) {
    const lab = t.label.toLowerCase();
    if (lab === p) return t.id;
    if (lab.includes(p)) {
      const score = p.length / lab.length;
      if (!best || score > best.score) best = { id: t.id, score };
    }
  }
  return best?.id;
}

export async function expandTemplate(
  template: IntentTemplate,
  slots: Record<string, string>,
  ctx: VoiceIntentRequest['context'],
  authedUserId: string | null,
): Promise<ExpandResult> {
  const working: Record<string, string> = { ...slots };

  for (const spec of template.slots) {
    if (!spec.resolver) continue;
    const raw = working[spec.name]?.trim();
    if (!raw) continue;

    if (!authedUserId) {
      return { kind: 'unsupported', reason: 'Sign in required to access your records.' };
    }

    const domain = spec.resolver.domain;
    const res = await resolveByName(authedUserId, domain, raw);
    if (res.kind === 'ambiguous') {
      return {
        kind: 'clarify',
        intent: {
          type: 'clarify',
          question: 'Which one did you mean?',
          options: res.options.map((h) => h.name).slice(0, 5),
        },
      };
    }
    if (res.kind === 'none') {
      return {
        kind: 'clarify',
        intent: {
          type: 'clarify',
          question: `I could not find a ${domain} matching "${raw}" in your records. What is the exact name?`,
        },
      };
    }

    const returns = spec.resolver.returns ?? 'id';
    working[spec.name] = returns === 'id' ? res.hit.id : res.hit.name;
  }

  const stepsOut: VoiceIntent[] = [];

  for (const step of template.steps) {
    const expanded = await expandStep(step, working, ctx);
    if (expanded.kind === 'clarify') return expanded;
    if (expanded.kind === 'unsupported') return expanded;
    if (expanded.kind === 'skip') continue;
    stepsOut.push(expanded.intent);
  }

  return { kind: 'ok', steps: stepsOut };
}

type StepExpand =
  | { kind: 'ok'; intent: VoiceIntent }
  | { kind: 'clarify'; intent: Extract<VoiceIntent, { type: 'clarify' }> }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'skip' };

async function expandStep(
  step: TemplateStep,
  slots: Record<string, string>,
  ctx: VoiceIntentRequest['context'],
): Promise<StepExpand> {
  switch (step.type) {
    case 'navigate': {
      const node = getNodeById(step.nodeId);
      if (!node) {
        return { kind: 'unsupported', reason: `Unknown node ${step.nodeId}.` };
      }
      const base: Record<string, string> = node.query ? { ...node.query } : {};
      const extra = step.query ? substituteQuery(step.query, slots) : {};
      for (const [k, v] of Object.entries(extra)) {
        if (v === '') continue;
        base[k] = v;
      }
      const query = Object.keys(base).length ? base : undefined;

      let goalId: string | undefined;
      if (node.goals?.length === 1) goalId = node.goals[0]!.id;

      const intent: VoiceIntent = {
        type: 'navigate',
        path: node.path,
        query,
        reason: templateReason('navigate', node.title),
        goalId,
      };
      return { kind: 'ok', intent };
    }
    case 'set_query': {
      const query = substituteQuery(step.query, slots);
      const intent: VoiceIntent = {
        type: 'set_query',
        query,
        reason: templateReason('set_query'),
      };
      return { kind: 'ok', intent };
    }
    case 'action': {
      let value: string | undefined;
      if (step.value !== undefined) {
        value = substituteString(step.value, slots);
        if (step.skipIfEmpty && (!value || !value.trim())) {
          return { kind: 'skip' };
        }
      }

      let target_id = step.targetId;
      if (!target_id && step.targetPattern) {
        const found = findTargetByPattern(step.targetPattern, ctx.visibleTargets);
        if (!found) {
          return {
            kind: 'unsupported',
            reason: `No visible control matching "${step.targetPattern}".`,
          };
        }
        target_id = found;
      }
      if (!target_id) {
        return { kind: 'unsupported', reason: 'Action step missing target.' };
      }

      const intent: VoiceIntent = {
        type: 'action',
        target_id,
        value,
        reason: templateReason('action'),
      };
      return { kind: 'ok', intent };
    }
    default:
      return { kind: 'unsupported', reason: 'Unknown template step.' };
  }
}

function substituteQuery(q: Record<string, string | SlotPlaceholder>, slots: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    const s = substituteString(v, slots);
    if (s !== '') out[k] = s;
  }
  return out;
}

function templateReason(kind: string, title?: string): string {
  if (kind === 'navigate' && title) return `Going to ${title}.`;
  return 'Okay.';
}
