/**
 * Single audited boundary for voice → user-scoped DB reads. No cache; userId from JWT only.
 */

import { getPersonasAvailableForUser } from './personaService.js';
import { getFocusGroup, getFocusGroups } from './focusGroupService.js';
import { getAccessibleTemplatesForUser } from './simulationTemplateService.js';
import { getByUserId as getBusinessProfileByUserId } from './businessProfileService.js';
import {
  BUSINESS_PROFILE_SPEC,
  compileFrameworkPlainText,
} from '../constants/businessProfileSpec.js';
import { getChatSessionsByUserId } from './chatService.js';
import { getSimulationSessionsByUserId } from './simulationService.js';
import pool from '../config/database.js';

export type Domain =
  | 'persona'
  | 'focusGroup'
  | 'focusGroupMember'
  | 'simulationTemplate'
  | 'simulationSession'
  | 'personaFile'
  | 'businessProfile'
  | 'chat'
  | 'settings'
  | 'profile';

/** Merge transcript-hinted digest domains with path defaults (e.g. /simulate always sees templates + personas). */
export function mergeVoiceDigestDomains(pathname: string | undefined, fromTranscript: Domain[]): Domain[] {
  const set = new Set<Domain>(fromTranscript);
  const p = (pathname || '').trim();
  if (p === '/simulate') {
    set.add('simulationTemplate');
    set.add('persona');
    set.add('businessProfile');
  }
  return [...set];
}

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
      const hits: ResolveHit[] = [];
      hits.push({
        id: bp.id,
        name: 'Business profile (all frameworks)',
        meta: { scope: 'all' },
      });
      const answers = bp.answers || {};
      for (const sec of BUSINESS_PROFILE_SPEC) {
        for (const fw of sec.frameworks) {
          const text = compileFrameworkPlainText(sec.key, fw.key, answers);
          if (!text.trim()) continue;
          hits.push({
            id: `${bp.id}:${sec.key}.${fw.key}`,
            name: `${sec.shortLabel}: ${fw.title}`,
            meta: { frameworkId: `${sec.key}.${fw.key}` },
          });
        }
      }
      return hits.slice(0, Math.max(1, limit));
    }
    case 'chat': {
      const sessions = await getChatSessionsByUserId(userId);
      return sessions.slice(0, Math.min(limit, 10)).map((s) => ({
        id: s.id,
        name: s.name || 'Chat',
        meta: {},
      }));
    }
    case 'simulationSession': {
      const sessions = await getSimulationSessionsByUserId(userId);
      return sessions.slice(0, limit).map((s) => ({
        id: s.id,
        name: s.name || 'Simulation run',
        meta: {
          mode: s.mode || '',
          personaCount: String((s.persona_ids || []).length || (s.persona_id ? 1 : 0)),
        },
      }));
    }
    case 'personaFile': {
      const r = await pool.query(
        `SELECT pf.id, pf.persona_id, pf.name AS file_name, p.name AS persona_name
         FROM persona_files pf
         JOIN personas p ON p.id = pf.persona_id
         WHERE p.user_id = $1
         ORDER BY pf.created_at DESC
         LIMIT $2`,
        [userId, Math.max(1, limit)]
      );
      return r.rows.map((row: { id: string; file_name: string; persona_name: string; persona_id: string }) => ({
        id: row.id,
        name: row.file_name || 'Untitled file',
        meta: { persona: row.persona_name || '', personaId: row.persona_id },
      }));
    }
    case 'focusGroupMember': {
      const r = await pool.query(
        `SELECT fg.id AS focus_group_id, fg.name AS focus_group_name, p.id AS persona_id, p.name AS persona_name
         FROM focus_groups fg
         JOIN focus_group_personas fgp ON fgp.focus_group_id = fg.id
         JOIN personas p ON p.id = fgp.persona_id
         WHERE fg.user_id = $1
         ORDER BY fg.name ASC, p.name ASC
         LIMIT $2`,
        [userId, Math.max(1, limit)]
      );
      return r.rows.map((row: { focus_group_id: string; focus_group_name: string; persona_id: string; persona_name: string }) => ({
        id: `${row.focus_group_id}:${row.persona_id}`,
        name: `${row.persona_name} in ${row.focus_group_name}`,
        meta: {
          focusGroupId: row.focus_group_id,
          focusGroup: row.focus_group_name,
          personaId: row.persona_id,
        },
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

/**
 * Lightweight lookup helper used by the navigator agent during /observe replans.
 */
export async function lookupByDomain(
  domain: Domain,
  query: string,
  viewer: { userId: string }
): Promise<ResolveResult> {
  if (domain === 'focusGroupMember') {
    const groupResult = await resolveByName(viewer.userId, 'focusGroup', query);
    if (groupResult.kind !== 'unique') return groupResult;
    const group = await getFocusGroup(groupResult.hit.id, viewer.userId);
    if (!group) return { kind: 'none' };
    return {
      kind: 'unique',
      hit: {
        id: group.id,
        name: group.name,
        meta: { members: String(group.personaIds?.length ?? 0) },
      },
    };
  }
  return resolveByName(viewer.userId, domain, query);
}
