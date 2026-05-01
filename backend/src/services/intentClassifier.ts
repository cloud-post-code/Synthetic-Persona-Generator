import { GoogleGenAI } from '@google/genai';
import {
  type IntentTemplate,
  INTENT_TEMPLATES,
  getIntentByName,
} from '../voice/intentTemplates.js';
import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import type { SlotSpec } from '../voice/intentTemplates.js';

import { VOICE_AGENT_MODEL } from '../voice/voiceModel.js';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey });
}

function templateAllowed(t: IntentTemplate, ctx: VoiceIntentRequest['context'], userId: string | null): boolean {
  if (t.prerequisites?.auth === 'user' && !ctx.isAuthenticated) return false;
  if (t.prerequisites?.auth === 'admin' && (!ctx.isAuthenticated || !ctx.isAdmin)) return false;
  if (userId === null) {
    if (t.slots.some((s) => s.resolver)) return false;
    if (t.prerequisites?.auth) return false;
  }
  return true;
}

function norm(t: string): string {
  return t.trim().toLowerCase();
}

function extractEmail(transcript: string): string | undefined {
  const m = transcript.match(/\S+@\S+\.\S+/);
  return m?.[0];
}

function extractQuoted(transcript: string): string | undefined {
  const m =
    transcript.match(/["“']([^"”']+)["”']/) ||
    transcript.match(/«([^»]+)»/) ||
    transcript.match(/`([^`]+)`/);
  return m?.[1]?.trim();
}

function extractAfterKeyword(transcript: string): string | undefined {
  const patterns = [
    /(?:named|called)\s+(.+?)(?:\.|$)/i,
    /(?:template|simulation)\s+(?:called|named)\s+(.+?)(?:\.|$)/i,
    /(?:chat with|talk to|open chat with)\s+(.+?)(?:\.|$)/i,
    /(?:focus group)\s+(?:called|named)?\s*(.+?)(?:\.|$)/i,
  ];
  for (const re of patterns) {
    const m = transcript.match(re);
    if (m?.[1]) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  const quoted = extractQuoted(transcript);
  if (quoted) return quoted;
  return undefined;
}

function extractUsername(transcript: string): string | undefined {
  const email = extractEmail(transcript);
  if (email) return email;
  const u = transcript.match(/\buser(?:name)?\s+is\s+(\S+)/i);
  if (u?.[1]) return u[1];
  return undefined;
}

function extractSlotValue(spec: SlotSpec, transcript: string): string | undefined {
  for (const ex of spec.extractors ?? []) {
    let v: string | undefined;
    switch (ex) {
      case 'email':
        v = extractEmail(transcript);
        break;
      case 'quoted':
        v = extractQuoted(transcript);
        break;
      case 'after_keyword':
        v = extractAfterKeyword(transcript);
        break;
      case 'username':
        v = extractUsername(transcript);
        break;
      default:
        break;
    }
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function computeMissing(template: IntentTemplate, slots: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const s of template.slots) {
    if (!s.required) continue;
    const v = slots[s.name];
    if (v && String(v).trim()) continue;
    missing.push(s.name);
  }
  return missing;
}

function phraseMatch(transcript: string, template: IntentTemplate): boolean {
  const t = norm(transcript);
  return template.triggers.phrases.some((p) => t.includes(norm(p)));
}

function keywordScore(transcript: string, template: IntentTemplate): number {
  const t = norm(transcript);
  let s = 0;
  for (const kw of template.triggers.keywords) {
    if (t.includes(kw.toLowerCase())) s += 1;
  }
  return s;
}

export type ClassifyResult =
  | { kind: 'matched'; template: IntentTemplate; slots: Record<string, string>; missing: string[] }
  | { kind: 'no_match' };

async function classifyWithLLM(
  transcript: string,
  candidates: IntentTemplate[],
): Promise<{ template: IntentTemplate; slots: Record<string, string> } | null> {
  const ai = getAI();
  const list = candidates.map((c) => `- ${c.name}: ${c.description}`).join('\n');
  const system = `You classify the user's utterance into at most ONE intent from the list, or NONE.
Return ONLY JSON: {"intent":"NAME_OR_NONE","slots":{"slotName":"value"}}.
Use slot keys only when clearly implied; use {} for slots if unknown.`;

  const user = `Utterance: ${transcript}\n\nIntents:\n${list}`;

  const response = await ai.models.generateContent({
    model: VOICE_AGENT_MODEL,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '{}';
  let parsed: { intent?: string; slots?: Record<string, string> };
  try {
    parsed = JSON.parse(text) as { intent?: string; slots?: Record<string, string> };
  } catch {
    return null;
  }
  const name = parsed.intent;
  if (!name || name === 'NONE' || name === 'none') return null;
  const tmpl = getIntentByName(name);
  if (!tmpl || !candidates.some((c) => c.name === tmpl.name)) return null;
  const slots = parsed.slots && typeof parsed.slots === 'object' ? parsed.slots : {};
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(slots)) {
    if (v != null && String(v).trim()) cleaned[k] = String(v).trim();
  }
  return { template: tmpl, slots: cleaned };
}

function extractAllSlots(template: IntentTemplate, transcript: string): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const spec of template.slots) {
    const v = extractSlotValue(spec, transcript);
    if (v) slots[spec.name] = v;
  }
  return slots;
}

function mergeSlotsPreferExtracted(
  template: IntentTemplate,
  extracted: Record<string, string>,
  llm: Record<string, string>,
): Record<string, string> {
  const out = { ...llm };
  for (const spec of template.slots) {
    const ex = extracted[spec.name];
    if (ex && ex.trim()) out[spec.name] = ex.trim();
  }
  return out;
}

export async function classifyIntent(
  body: VoiceIntentRequest,
  auth: { userId: string | null },
): Promise<ClassifyResult> {
  const transcript = body.transcript.trim();
  if (!transcript) return { kind: 'no_match' };

  const allowed = INTENT_TEMPLATES.filter((t) => templateAllowed(t, body.context, auth.userId));

  for (const t of allowed) {
    if (phraseMatch(transcript, t)) {
      const extracted = extractAllSlots(t, transcript);
      const missing = computeMissing(t, extracted);
      return { kind: 'matched', template: t, slots: extracted, missing };
    }
  }

  let best: IntentTemplate | null = null;
  let bestScore = 0;
  let second = 0;
  for (const t of allowed) {
    const s = keywordScore(transcript, t);
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = t;
    } else if (s > second) {
      second = s;
    }
  }
  if (best && bestScore >= 1 && bestScore > second) {
    const extracted = extractAllSlots(best, transcript);
    const missing = computeMissing(best, extracted);
    return { kind: 'matched', template: best, slots: extracted, missing };
  }

  try {
    const picked = await classifyWithLLM(transcript, allowed);
    if (picked) {
      const extracted = extractAllSlots(picked.template, transcript);
      const merged = mergeSlotsPreferExtracted(picked.template, extracted, picked.slots);
      const missing = computeMissing(picked.template, merged);
      return { kind: 'matched', template: picked.template, slots: merged, missing };
    }
  } catch {
    /* LLM unavailable */
  }

  return { kind: 'no_match' };
}
