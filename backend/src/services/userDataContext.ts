/**
 * Single audited boundary for voice → user-scoped DB reads. No cache; userId from JWT only.
 */

import { getPersonasAvailableForUser } from './personaService.js';
import { getFocusGroups } from './focusGroupService.js';
import { getAccessibleTemplatesForUser } from './simulationTemplateService.js';
import { getByUserId as getBusinessProfileByUserId } from './businessProfileService.js';
import { getChatSessionsByUserId } from './chatService.js';

export type Domain =
  | 'persona'
  | 'focusGroup'
  | 'simulationTemplate'
  | 'businessProfile'
  | 'chat'
  | 'settings'
  | 'profile';

export type ResolveHit = { id: string; name: string; meta?: Record<string, string> };

export type ResolveResult =
  | { kind: 'unique'; hit: ResolveHit }
  | { kind: 'ambiguous'; options: ResolveHit[] }
  | { kind: 'none' };

const DIGEST_LIMIT = 20;
const AMBIGUOUS_LIMIT = 5;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function scoreName(name: string, query: string): number {
  const n = norm(name);
  const q = norm(query);
  if (!q) return 0;
  if (n === q) return 100;
  if (n.includes(q)) return 50;
  if (q.includes(n) && n.length >= 3) return 40;
  if (n.split(/\s+/).some((w) => w.length > 2 && q.includes(w))) return 20;
  return 0;
}

export async function resolveByName(
  userId: string,
  domain: Domain,
  query: string,
): Promise<ResolveResult> {
  const digest = await getDigest(userId, domain, DIGEST_LIMIT);
  const q = norm(query);
  if (!q) return { kind: 'none' };

  const scored = digest
    .map((h) => ({ h, score: scoreName(h.name, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.name.localeCompare(b.h.name));

  if (scored.length === 0) return { kind: 'none' };
  if (scored.length === 1) return { kind: 'unique', hit: scored[0]!.h };

  const topScore = scored[0]!.score;
  const tied = scored.filter((x) => x.score === topScore);
  if (tied.length === 1) return { kind: 'unique', hit: tied[0]!.h };
  return { kind: 'ambiguous', options: tied.slice(0, AMBIGUOUS_LIMIT).map((x) => x.h) };
}

export type DigestViewer = { username?: string; isAdmin?: boolean };

export async function getDigest(
  userId: string,
  domain: Domain,
  limit: number = DIGEST_LIMIT,
  viewer?: DigestViewer,
): Promise<ResolveHit[]> {
  switch (domain) {
    case 'persona': {
      const list = await getPersonasAvailableForUser(userId);
      return list.slice(0, limit).map((p) => ({
        id: p.id,
        name: p.name || 'Unnamed',
        meta: { type: p.type || '' },
      }));
    }
    case 'focusGroup': {
      const list = await getFocusGroups(userId);
      return list.slice(0, limit).map((g) => ({
        id: g.id,
        name: g.name || 'Untitled',
        meta: { members: String(g.personaIds?.length ?? 0) },
      }));
    }
    case 'simulationTemplate': {
      const list = await getAccessibleTemplatesForUser(userId);
      return list.slice(0, limit).map((s) => ({
        id: s.id,
        name: s.title || 'Untitled',
        meta: { type: s.simulation_type || '' },
      }));
    }
    case 'businessProfile': {
      const bp = await getBusinessProfileByUserId(userId);
      if (!bp) return [];
      return [
        {
          id: bp.id,
          name: bp.business_name || 'Business',
          meta: { industry: bp.industry_served || '' },
        },
      ];
    }
    case 'chat': {
      const sessions = await getChatSessionsByUserId(userId);
      return sessions.slice(0, Math.min(limit, 10)).map((s) => ({
        id: s.id,
        name: s.name || 'Chat',
        meta: {},
      }));
    }
    case 'settings': {
      return [];
    }
    case 'profile': {
      return [
        {
          id: userId,
          name: viewer?.username || 'user',
          meta: { isAdmin: String(viewer?.isAdmin ?? false) },
        },
      ];
    }
    default:
      return [];
  }
}
