import type { Domain } from '../services/userDataContext.js';

/** Utterance clearly asks for more than navigation alone — skip navigate-only named templates so the planner can batch. */
export function transcriptSuggestsMultiStep(transcript: string): boolean {
  const s = transcript.toLowerCase();
  return (
    /\b(and\s+then|then\s+(open|go|navigate|save|fill|click|run|start|submit|press))/.test(s) ||
    /\b(and\s+(open|go|save|fill|run|start|submit|click|press))/.test(s) ||
    /\b(save\s+it|fill\s+(it|in|out)|submit\s+it|run\s+it|run\s+the|start\s+the)\b/.test(s) ||
    /\b(then\s+save|then\s+fill|then\s+run|then\s+open|then\s+go)\b/.test(s) ||
    /\b(after\s+that|next\s+step|continue\s+(to|with))\b/.test(s) ||
    /\b(all\s+the\s+way|end\s+to\s+end|complete\s+(the|my)|finish\s+(it|the))\b/.test(s)
  );
}

export function hintedDomainsFromTranscript(transcript: string): Domain[] {
  const t = transcript.toLowerCase();
  const out = new Set<Domain>();
  if (/\b(persona|character|synthetic)\b/.test(t)) out.add('persona');
  if (/\bfocus\s*group\b|\bcohort\b/.test(t)) out.add('focusGroup');
  if (/\b(member|participant|in\s+the\s+focus\s*group|who(?:'s|\s+is)\s+in)\b/.test(t)) {
    out.add('focusGroupMember');
  }
  if (/\bsimulation\b|\btemplate\b|\brun\s+(the\s+)?sim/.test(t)) out.add('simulationTemplate');
  if (/\b(simulation\s+(run|session)|past\s+sim|previous\s+sim|recent\s+sim|my\s+sim)\b/.test(t)) {
    out.add('simulationSession');
  }
  if (/\b(file|document|upload|pdf|attachment|blueprint)\b/.test(t)) out.add('personaFile');
  if (/\bbusiness\b|\bcompany\b/.test(t)) out.add('businessProfile');
  if (/\bchat\b|\bconversation\b|\bmessage\b/.test(t)) out.add('chat');
  if (/\bsettings\b|\bpreferences\b|\baccount\b/.test(t)) out.add('settings');
  if (/\bprofile\b|\bwho am i\b/.test(t)) out.add('profile');
  return [...out];
}
