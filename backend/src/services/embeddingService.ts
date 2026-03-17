import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import pool from '../config/database.js';

const EMBEDDING_MODEL = 'text-embedding-004';
const CHUNK_MAX_WORDS = 400;
const CHUNK_OVERLAP_WORDS = 80;
const EMBED_BATCH_SIZE = 100;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function chunkText(text: string, maxWords = CHUNK_MAX_WORDS, overlapWords = CHUNK_OVERLAP_WORDS): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentWords: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (currentWords.length + words.length > maxWords && currentWords.length > 0) {
      chunks.push(currentWords.join(' '));
      const overlapStart = Math.max(0, currentWords.length - overlapWords);
      currentWords = currentWords.slice(overlapStart);
    }

    currentWords.push(...words);

    while (currentWords.length > maxWords) {
      const slice = currentWords.slice(0, maxWords);
      chunks.push(slice.join(' '));
      const overlapStart = Math.max(0, maxWords - overlapWords);
      currentWords = currentWords.slice(overlapStart);
    }
  }

  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '));
  }

  return chunks;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getAI();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
    });
    const embeddings = response.embeddings;
    if (!embeddings) throw new Error('Embedding API returned no embeddings');
    for (const emb of embeddings) {
      allEmbeddings.push(emb.values as number[]);
    }
  }

  return allEmbeddings;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function indexPersona(personaId: string): Promise<void> {
  const personaResult = await pool.query(
    'SELECT id, name, description FROM personas WHERE id = $1',
    [personaId]
  );
  if (personaResult.rows.length === 0) return;

  const persona = personaResult.rows[0];
  const filesResult = await pool.query(
    'SELECT id, name, content, type FROM persona_files WHERE persona_id = $1',
    [personaId]
  );

  interface ChunkEntry {
    text: string;
    sourceType: string;
    sourceName: string;
    index: number;
  }
  const allChunks: ChunkEntry[] = [];

  if (persona.description) {
    const profileText = `Name: ${persona.name}\n\n${persona.description}`;
    const chunks = chunkText(profileText);
    chunks.forEach((text, idx) => {
      allChunks.push({ text, sourceType: 'profile', sourceName: 'description', index: idx });
    });
  }

  for (const file of filesResult.rows) {
    if (!file.content) continue;
    const chunks = chunkText(file.content);
    chunks.forEach((text, idx) => {
      allChunks.push({ text, sourceType: 'file', sourceName: file.name, index: idx });
    });
  }

  if (allChunks.length === 0) return;

  const embeddings = await embedTexts(allChunks.map(c => c.text));

  await pool.query('DELETE FROM knowledge_chunks WHERE persona_id = $1', [personaId]);

  const insertValues: string[] = [];
  const insertParams: any[] = [];
  let paramIdx = 1;

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embedding = embeddings[i];
    const hash = sha256(chunk.text);
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
    );
    insertParams.push(personaId, chunk.sourceType, chunk.sourceName, chunk.text, chunk.index, embedding, hash);
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (persona_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  console.log(`Indexed ${allChunks.length} chunks for persona ${personaId}`);
}

export async function indexBusinessProfile(userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT business_name, mission_statement, vision_statement, description_main_offerings,
            key_features_or_benefits, unique_selling_proposition, pricing_model, customer_segments,
            geographic_focus, industry_served, what_differentiates, market_niche, revenue_streams,
            distribution_channels, key_personnel, major_achievements, revenue,
            key_performance_indicators, funding_rounds, website
     FROM business_profiles WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return;

  const profile = result.rows[0];
  const labels: [string, string][] = [
    ['Business name', profile.business_name],
    ['Mission', profile.mission_statement],
    ['Vision', profile.vision_statement],
    ['Main offerings', profile.description_main_offerings],
    ['Key features/benefits', profile.key_features_or_benefits],
    ['USP', profile.unique_selling_proposition],
    ['Pricing model', profile.pricing_model],
    ['Customer segments', profile.customer_segments],
    ['Geographic focus', profile.geographic_focus],
    ['Industry served', profile.industry_served],
    ['What differentiates', profile.what_differentiates],
    ['Market niche', profile.market_niche],
    ['Revenue streams', profile.revenue_streams],
    ['Distribution channels', profile.distribution_channels],
    ['Key personnel', profile.key_personnel],
    ['Major achievements', profile.major_achievements],
    ['Revenue', profile.revenue],
    ['KPIs', profile.key_performance_indicators],
    ['Funding', profile.funding_rounds],
    ['Website', profile.website],
  ];

  const profileText = labels
    .filter(([, v]) => v && String(v).trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join('\n');

  if (!profileText) return;

  const chunks = chunkText(profileText);
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks);

  await pool.query(
    `DELETE FROM knowledge_chunks WHERE user_id = $1 AND source_type = 'business_profile'`,
    [userId]
  );

  const insertValues: string[] = [];
  const insertParams: any[] = [];
  let paramIdx = 1;

  for (let i = 0; i < chunks.length; i++) {
    const hash = sha256(chunks[i]);
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
    );
    insertParams.push(userId, 'business_profile', 'business_profile', chunks[i], i, embeddings[i], hash);
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (user_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  console.log(`Indexed ${chunks.length} business profile chunks for user ${userId}`);
}

export async function indexSessionContext(sessionId: string, fields: Record<string, string>): Promise<void> {
  interface ChunkEntry {
    text: string;
    sourceName: string;
    index: number;
  }
  const allChunks: ChunkEntry[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || !value.trim()) continue;
    const chunks = chunkText(value);
    chunks.forEach((text, idx) => {
      allChunks.push({ text, sourceName: fieldName, index: idx });
    });
  }

  if (allChunks.length === 0) return;

  const embeddings = await embedTexts(allChunks.map(c => c.text));

  await pool.query('DELETE FROM knowledge_chunks WHERE session_id = $1', [sessionId]);

  const insertValues: string[] = [];
  const insertParams: any[] = [];
  let paramIdx = 1;

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embedding = embeddings[i];
    const hash = sha256(chunk.text);
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`
    );
    insertParams.push(sessionId, 'session_context', chunk.sourceName, chunk.text, chunk.index, embedding, hash);
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (session_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  console.log(`Indexed ${allChunks.length} session context chunks for session ${sessionId}`);
}

export interface RetrievedChunk {
  text: string;
  source_type: string;
  source_name: string;
  score: number;
}

export async function retrieve(
  query: string,
  personaIds: string[],
  sessionId?: string,
  topK = 10,
  userId?: string
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([query]);

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (personaIds.length > 0) {
    conditions.push(`persona_id = ANY($${paramIdx})`);
    params.push(personaIds);
    paramIdx++;
  }
  if (sessionId) {
    conditions.push(`session_id = $${paramIdx}`);
    params.push(sessionId);
    paramIdx++;
  }
  if (userId) {
    conditions.push(`user_id = $${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }

  if (conditions.length === 0) return [];

  const whereClause = conditions.join(' OR ');
  const result = await pool.query(
    `SELECT chunk_text, source_type, source_name, embedding FROM knowledge_chunks WHERE ${whereClause}`,
    params
  );

  const scored = result.rows
    .filter((row: any) => row.embedding && row.embedding.length > 0)
    .map((row: any) => {
      const embedding: number[] = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;
      return {
        text: row.chunk_text,
        source_type: row.source_type,
        source_name: row.source_name,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    });

  scored.sort((a: RetrievedChunk, b: RetrievedChunk) => b.score - a.score);
  return scored.slice(0, topK);
}
