import type { Pool } from 'pg';
import { parseBusinessProfileAnswersJson } from '../constants/businessProfileSpec.js';
import { legacyFlatColumnsToAnswers } from '../services/businessProfileService.js';

const LEGACY_COLUMNS = [
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
] as const;

/**
 * Ensure business_profiles uses JSONB `answers` only; migrate legacy flat columns once.
 */
export async function migrateBusinessProfilesToJsonb(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      knowledge_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
      company_hint TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id)');

  const cols = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_profiles'
  `);
  const colSet = new Set(cols.rows.map((r) => r.column_name));

  if (!colSet.has('answers')) {
    await pool.query(
      `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb`
    );
  }

  if (!colSet.has('knowledge_documents')) {
    await pool.query(
      `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS knowledge_documents JSONB NOT NULL DEFAULT '[]'::jsonb`
    );
  }

  if (!colSet.has('company_hint')) {
    await pool.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS company_hint TEXT`);
  }

  if (!colSet.has('business_name')) {
    return;
  }

  const rows = await pool.query<Record<string, unknown>>(`SELECT * FROM business_profiles`);
  for (const row of rows.rows) {
    const existing = parseBusinessProfileAnswersJson(row.answers);
    const fromLegacy = legacyFlatColumnsToAnswers(row);
    const merged = { ...existing, ...fromLegacy };
    await pool.query(`UPDATE business_profiles SET answers = $1::jsonb WHERE id = $2`, [
      JSON.stringify(merged),
      row.id,
    ]);
  }

  for (const c of LEGACY_COLUMNS) {
    try {
      await pool.query(`ALTER TABLE business_profiles DROP COLUMN IF EXISTS ${c}`);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (code !== '42703') throw err;
    }
  }

  console.log('[migrate] business_profiles: migrated to answers JSONB, legacy columns dropped');
}
