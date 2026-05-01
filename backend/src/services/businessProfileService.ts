import pool from '../config/database.js';
import {
  BusinessProfile,
  BusinessProfileKnowledgeDocument,
  CreateOrUpdateBusinessProfileRequest,
} from '../types/index.js';
import { indexBusinessProfile } from './embeddingService.js';
import {
  businessProfileAnswerKey,
  getBusinessProfileAllowedAnswerKeySet,
  parseBusinessProfileAnswersJson,
} from '../constants/businessProfileSpec.js';
import { parseKnowledgeDocumentsJson } from '../utils/businessProfileKnowledge.js';

export { BP_KNOWLEDGE_MAX_DOCS } from '../utils/businessProfileKnowledge.js';

function mapRow(row: Record<string, unknown>): BusinessProfile {
  const ch = row.company_hint;
  const companyHint =
    ch == null || ch === '' ? null : typeof ch === 'string' ? ch : String(ch);
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    answers: parseBusinessProfileAnswersJson(row.answers),
    knowledge_documents: parseKnowledgeDocumentsJson(row.knowledge_documents),
    company_hint: companyHint,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export async function getByUserId(userId: string): Promise<BusinessProfile | null> {
  const result = await pool.query(
    `SELECT id, user_id, answers, knowledge_documents, company_hint, created_at, updated_at
     FROM business_profiles
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0] as Record<string, unknown>);
}

/** Full replace of allowed keys when `answers` is provided; otherwise keep existing profile. */
function answersFromRequest(
  data: CreateOrUpdateBusinessProfileRequest,
  existing: BusinessProfile | null,
  allowed: Set<string>
): Record<string, string> {
  const raw = data.answers;
  if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!allowed.has(k)) continue;
      if (v === undefined || v === null) continue;
      const s = typeof v === 'string' ? v.trim() : String(v).trim();
      if (s) out[k] = s;
    }
    return out;
  }
  return { ...(existing?.answers ?? {}) };
}

function knowledgeDocumentsFromRequest(
  data: Record<string, unknown>,
  existing: BusinessProfile | null,
): BusinessProfileKnowledgeDocument[] {
  if (!Object.prototype.hasOwnProperty.call(data, 'knowledge_documents')) {
    return existing?.knowledge_documents ?? [];
  }
  return parseKnowledgeDocumentsJson(data.knowledge_documents);
}

function companyHintFromRequest(data: Record<string, unknown>, existing: BusinessProfile | null): string | null {
  if (!Object.prototype.hasOwnProperty.call(data, 'company_hint')) {
    return existing?.company_hint ?? null;
  }
  const v = data.company_hint;
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s || null;
}

export async function upsert(
  userId: string,
  data: CreateOrUpdateBusinessProfileRequest
): Promise<BusinessProfile> {
  const allowed = getBusinessProfileAllowedAnswerKeySet();
  const existing = await getByUserId(userId);
  const mergedClean = answersFromRequest(data, existing, allowed);
  const mergedKnowledge = knowledgeDocumentsFromRequest(data as Record<string, unknown>, existing);
  const mergedCompanyHint = companyHintFromRequest(data as Record<string, unknown>, existing);
  const answersJson = JSON.stringify(mergedClean);
  const knowledgeJson = JSON.stringify(mergedKnowledge);

  try {
    const result = await pool.query(
      `INSERT INTO business_profiles (user_id, answers, knowledge_documents, company_hint)
       VALUES ($1, $2::jsonb, $3::jsonb, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         knowledge_documents = EXCLUDED.knowledge_documents,
         company_hint = EXCLUDED.company_hint,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, user_id, answers, knowledge_documents, company_hint, created_at, updated_at`,
      [userId, answersJson, knowledgeJson, mergedCompanyHint]
    );

    let profile: BusinessProfile;
    if (result.rows && result.rows.length > 0) {
      profile = mapRow(result.rows[0] as Record<string, unknown>);
    } else {
      const refetch = await pool.query(
        `SELECT id, user_id, answers, knowledge_documents, company_hint, created_at, updated_at
         FROM business_profiles WHERE user_id = $1`,
        [userId]
      );
      if (refetch.rows.length === 0) {
        throw new Error('Business profile upsert returned no row');
      }
      profile = mapRow(refetch.rows[0] as Record<string, unknown>);
    }

    (async () => {
      try {
        await indexBusinessProfile(userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[EMBEDDING] Business profile indexing failed for user ${userId}:`, msg);
        await new Promise((r) => setTimeout(r, 2000));
        try {
          await indexBusinessProfile(userId);
          console.log(`[EMBEDDING] Business profile retry succeeded for user ${userId}`);
        } catch (retryErr: unknown) {
          const rmsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.error(`[EMBEDDING] Business profile retry also failed for user ${userId}:`, rmsg);
        }
      }
    })();

    return profile;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : undefined;
    console.error('businessProfileService.upsert error:', msg, code, err);
    throw err;
  }
}

/** Map legacy flat columns into spec answer keys (best-effort). Exported for migrate script. */
export function legacyFlatColumnsToAnswers(row: Record<string, unknown>): Record<string, string> {
  const a: Record<string, string> = {};
  const add = (section: string, fw: string, q: string, val: unknown) => {
    if (val == null) return;
    const s = String(val).trim();
    if (!s) return;
    const key = businessProfileAnswerKey(section, fw, q);
    if (a[key]) a[key] = `${a[key]}\n\n${s}`;
    else a[key] = s;
  };

  add('problem_solution', 'value_proposition', 'why_care', row.mission_statement);
  add('problem_solution', 'value_proposition', 'outcome', row.vision_statement);
  add('problem_solution', 'your_solution', 'product', row.description_main_offerings);
  add('product_design', 'core_features', 'must_have', row.key_features_or_benefits);
  add('problem_solution', 'your_solution', 'uniqueness', row.unique_selling_proposition);
  add('monetization', 'revenue_model', 'charge_model', row.pricing_model);
  add('who_is_customer', 'customer_segmentation', 'segments', row.customer_segments);
  add('who_is_customer', 'beachhead_market', 'group_accessible', row.geographic_focus);
  add('who_is_customer', 'target_customer_persona', 'industry', row.industry_served);
  add('product_design', 'differentiation', 'stand_out', row.what_differentiates);
  add('who_is_customer', 'beachhead_market', 'niche_first', row.market_niche);
  add('monetization', 'scaling_revenue', 'long_term_growth', row.revenue_streams);
  add('acquisition', 'acquisition_channels', 'channels_list', row.distribution_channels);
  add('building_scaling', 'team', 'key_roles', row.key_personnel);
  add('building_scaling', 'go_to_market_plan', 'traction_strategy', row.major_achievements);
  add('monetization', 'willingness_to_pay', 'current_spend', row.revenue);
  add('building_scaling', 'go_to_market_plan', 'success_metrics', row.key_performance_indicators);
  add('building_scaling', 'operations', 'tools_systems', row.funding_rounds);
  const web = row.website != null ? String(row.website).trim() : '';
  if (web) {
    add('acquisition', 'customer_journey', 'discovery', `Company website: ${web}`);
  }

  const bn = row.business_name != null ? String(row.business_name).trim() : '';
  if (bn) {
    const pk = businessProfileAnswerKey('who_is_customer', 'target_customer_persona', 'primary_customer');
    a[pk] = a[pk] ? `Company: ${bn}\n\n${a[pk]}` : `Company: ${bn}`;
  }

  return a;
}
