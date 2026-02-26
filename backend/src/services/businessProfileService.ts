import pool from '../config/database.js';
import { BusinessProfile, CreateOrUpdateBusinessProfileRequest } from '../types/index.js';

const COLUMNS = [
  'business_name',
  'mission_statement',
  'vision_statement',
  'description_main_offerings',
  'key_features_or_benefits',
  'unique_selling_proposition',
  'pricing_model',
  'customer_segments',
  'geographic_focus',
  'industry_served',
  'what_differentiates',
  'market_niche',
  'revenue_streams',
  'distribution_channels',
  'key_personnel',
  'major_achievements',
  'revenue',
  'key_performance_indicators',
  'funding_rounds',
  'website',
];

function mapRow(row: Record<string, unknown>): BusinessProfile {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    business_name: row.business_name as string | null ?? undefined,
    mission_statement: row.mission_statement as string | null ?? undefined,
    vision_statement: row.vision_statement as string | null ?? undefined,
    description_main_offerings: row.description_main_offerings as string | null ?? undefined,
    key_features_or_benefits: row.key_features_or_benefits as string | null ?? undefined,
    unique_selling_proposition: row.unique_selling_proposition as string | null ?? undefined,
    pricing_model: row.pricing_model as string | null ?? undefined,
    customer_segments: row.customer_segments as string | null ?? undefined,
    geographic_focus: row.geographic_focus as string | null ?? undefined,
    industry_served: row.industry_served as string | null ?? undefined,
    what_differentiates: row.what_differentiates as string | null ?? undefined,
    market_niche: row.market_niche as string | null ?? undefined,
    revenue_streams: row.revenue_streams as string | null ?? undefined,
    distribution_channels: row.distribution_channels as string | null ?? undefined,
    key_personnel: row.key_personnel as string | null ?? undefined,
    major_achievements: row.major_achievements as string | null ?? undefined,
    revenue: row.revenue as string | null ?? undefined,
    key_performance_indicators: row.key_performance_indicators as string | null ?? undefined,
    funding_rounds: row.funding_rounds as string | null ?? undefined,
    website: row.website as string | null ?? undefined,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export async function getByUserId(userId: string): Promise<BusinessProfile | null> {
  const result = await pool.query(
    `SELECT id, user_id, ${COLUMNS.join(', ')}, created_at, updated_at
     FROM business_profiles
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function upsert(
  userId: string,
  data: CreateOrUpdateBusinessProfileRequest
): Promise<BusinessProfile> {
  const allowedKeys = new Set(COLUMNS);
  const sanitized: Record<string, string | null> = {};
  const input = (data != null && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(input)) {
    if (allowedKeys.has(key)) {
      if (value === undefined || value === null || value === '') {
        sanitized[key] = null;
      } else {
        const s = typeof value === 'string' ? value : String(value);
        sanitized[key] = s.trim() || null;
      }
    }
  }
  const valuesForColumns = COLUMNS.map((c) => (sanitized[c] !== undefined ? sanitized[c] : null));

  try {
    const existing = await pool.query(
      `SELECT id FROM business_profiles WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      const updateSet = COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const updateValues = [...valuesForColumns, userId];
      const result = await pool.query(
        `UPDATE business_profiles SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $${COLUMNS.length + 1}
         RETURNING id, user_id, ${COLUMNS.join(', ')}, created_at, updated_at`,
        updateValues
      );
      if (result.rows && result.rows.length > 0) {
        return mapRow(result.rows[0]);
      }
      const refetch = await pool.query(
        `SELECT id, user_id, ${COLUMNS.join(', ')}, created_at, updated_at
         FROM business_profiles WHERE user_id = $1`,
        [userId]
      );
      if (refetch.rows.length === 0) throw new Error('Business profile update returned no row');
      return mapRow(refetch.rows[0]);
    }

    const insertValues = [userId, ...valuesForColumns];
    const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
    const cols = ['user_id', ...COLUMNS];
    const result = await pool.query(
      `INSERT INTO business_profiles (${cols.join(', ')})
       VALUES (${placeholders})
       RETURNING id, user_id, ${COLUMNS.join(', ')}, created_at, updated_at`,
      insertValues
    );
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Business profile insert returned no row');
    }
    return mapRow(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : undefined;
    console.error('businessProfileService.upsert error:', msg, code, err);
    throw err;
  }
}
