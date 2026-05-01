import type { VoiceIntentRequest } from '../types/voiceIntentRequest.js';
import type { Domain } from '../services/userDataContext.js';
import { getDigest, mergeVoiceDigestDomains, type DigestViewer } from '../services/userDataContext.js';
import {
  retrieveUiSemantics,
  UI_SEMANTIC_SOURCE_TYPES,
} from '../services/embeddingService.js';
import type { UiSemanticType } from './uiSemantics.js';
import { hintedDomainsFromTranscript, transcriptSuggestsMultiStep } from './voiceTranscriptHints.js';

const SEMANTICS_TOPK = 8;

export async function buildDigestBlock(
  userId: string,
  domains: Domain[],
  viewer?: DigestViewer
): Promise<string> {
  if (domains.length === 0) return '';
  const lines: string[] = ['', '### USER_DATA (live, scoped to you)'];
  for (const d of domains) {
    const hits = await getDigest(userId, d, 20, viewer);
    console.info('[voice.userdata]', { userId, domain: d, hits: hits.length });
    lines.push(`${String(d).toUpperCase()}:`);
    if (hits.length === 0) lines.push('  (none)');
    else {
      for (const h of hits) {
        const meta = h.meta ? ` | meta:${JSON.stringify(h.meta)}` : '';
        lines.push(`  - id:${h.id} | name:${JSON.stringify(h.name)}${meta}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * Pull the most relevant chunks from the embedded UI semantics corpus.
 * Best-effort: returns '' on any failure so the voice agent still works without RAG.
 */
export async function buildSemanticsBlock(
  query: string,
  topK: number = SEMANTICS_TOPK,
  types?: UiSemanticType[]
): Promise<string> {
  if (!query.trim()) return '';
  try {
    const chunks = await retrieveUiSemantics(query, topK, types ?? UI_SEMANTIC_SOURCE_TYPES);
    if (chunks.length === 0) return '';
    const lines: string[] = ['', '### UI_SEMANTICS (retrieved RAG context)'];
    for (const c of chunks) {
      const score = typeof c.score === 'number' ? c.score.toFixed(3) : '?';
      lines.push(`-- ${c.source_type} | ${c.source_name} | score=${score}`);
      lines.push(c.text);
    }
    return lines.join('\n');
  } catch (err) {
    console.warn('[voice.semantics] retrieval failed', err);
    return '';
  }
}

export function buildSemanticsRetrievalQuery(
  transcript: string,
  currentNodeId: string | null | undefined,
  replanReason?: string
): string {
  const parts = [transcript.trim()];
  if (currentNodeId) parts.push(`CURRENT_NODE_ID: ${currentNodeId}`);
  if (replanReason?.trim()) parts.push(`Replan reason: ${replanReason.trim()}`);
  return parts.join('\n\n');
}

/**
 * Appends USER_DATA and UI_SEMANTICS blocks to `uiMapPrompt`. Digest requires `userId`.
 */
export async function enrichVoiceUiMapPrompt(input: {
  body: VoiceIntentRequest;
  auth: { userId: string | null };
  viewer?: DigestViewer;
  digestDomains: Domain[];
  semanticsQuery: string;
}): Promise<VoiceIntentRequest> {
  const { body, auth, viewer, digestDomains, semanticsQuery } = input;
  const digestBlock =
    auth.userId && digestDomains.length > 0 ? await buildDigestBlock(auth.userId, digestDomains, viewer) : '';
  const semanticsBlock = await buildSemanticsBlock(semanticsQuery);
  return {
    ...body,
    uiMapPrompt: `${body.uiMapPrompt}${digestBlock}${semanticsBlock}`,
  };
}

/** Default digest domains: transcript hints merged with path + current node. */
export function defaultDigestDomainsForVoice(body: VoiceIntentRequest): Domain[] {
  return mergeVoiceDigestDomains(
    body.context.pathname,
    body.context.currentNodeId ?? null,
    hintedDomainsFromTranscript(body.transcript)
  );
}

export function buildPlannerUserHints(body: VoiceIntentRequest): string {
  const n = body.context.visibleTargets.length;
  const lines: string[] = [];
  if (body.context.currentNodeId) {
    lines.push(`CURRENT_NODE_ID: ${body.context.currentNodeId}`);
  }
  if (n >= 2) {
    lines.push(
      `VISIBLE_TARGET_COUNT: ${n} — if the user wants to act on this screen (fill, save, run, etc.), include those action steps in the same batch or array after any navigate/set_query.`
    );
  }
  if (transcriptSuggestsMultiStep(body.transcript)) {
    lines.push(
      'MULTI_STEP_UTTERANCE: true — the user implied a sequence; respond with a JSON array or {"type":"batch","steps":[...]} covering the full sequence (navigation first if needed, then actions).'
    );
  }
  return lines.length ? `\n${lines.join('\n')}` : '';
}
