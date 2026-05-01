import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import pool from '../config/database.js';
import type { UiSemanticDoc, UiSemanticType, UiSemanticsCorpus } from '../voice/uiSemantics.js';
import {
  BUSINESS_PROFILE_SPEC,
  compileFrameworkPlainText,
  parseBusinessProfileAnswersJson,
} from '../constants/businessProfileSpec.js';
import { parseKnowledgeDocumentsJson } from '../utils/businessProfileKnowledge.js';
import { extractKnowledgeDocumentText } from '../utils/knowledgeDocumentText.js';

export const UI_SEMANTIC_SOURCE_TYPES: UiSemanticType[] = [
  'ui_node',
  'form_schema',
  'api_route',
  'db_table',
  'workflow',
];

const EMBEDDING_MODEL = 'gemini-embedding-001';
const CHUNK_MAX_WORDS = 400;
const CHUNK_OVERLAP_WORDS = 80;
const EMBED_BATCH_SIZE = 100;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured. Set a valid key in backend/.env');
  }
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
    console.log(`[EMBED] Calling text-embedding-004 for ${batch.length} texts (batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1})`);
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
    });
    const embeddings = response.embeddings;
    if (!embeddings || embeddings.length === 0) {
      throw new Error(`Embedding API returned no embeddings for batch of ${batch.length} texts`);
    }
    for (const emb of embeddings) {
      if (!emb.values || emb.values.length === 0) {
        throw new Error('Embedding API returned empty values for a text');
      }
      allEmbeddings.push(emb.values);
    }
    console.log(`[EMBED] Got ${embeddings.length} embeddings (${embeddings[0]?.values?.length || 0}-dim)`);
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
    const embeddingPgArray = `{${embedding.join(',')}}`;
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}::float8[], $${paramIdx + 6})`
    );
    insertParams.push(personaId, chunk.sourceType, chunk.sourceName, chunk.text, chunk.index, embeddingPgArray, hash);
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (persona_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
    console.log(`[EMBED] Inserted ${insertValues.length} chunks for persona ${personaId}`);
  }

  await pool.query(
    'UPDATE personas SET last_embedded_at = CURRENT_TIMESTAMP WHERE id = $1',
    [personaId]
  );

  console.log(`Indexed ${allChunks.length} chunks for persona ${personaId}`);
}

export async function indexBusinessProfile(userId: string): Promise<void> {
  const result = await pool.query(
    `SELECT answers, knowledge_documents FROM business_profiles WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return;

  const row = result.rows[0] as { answers: unknown; knowledge_documents: unknown };
  const answers = parseBusinessProfileAnswersJson(row.answers);
  const knowledgeDocs = parseKnowledgeDocumentsJson(row.knowledge_documents);

  await pool.query(
    `DELETE FROM knowledge_chunks WHERE user_id = $1 AND source_type IN ('business_profile', 'business_profile.framework', 'business_knowledge_doc')`,
    [userId]
  );

  const allChunks: { text: string; sourceName: string; chunkIndex: number; sourceType: string }[] = [];
  let flatIndex = 0;

  for (const sec of BUSINESS_PROFILE_SPEC) {
    for (const fw of sec.frameworks) {
      const frameworkText = compileFrameworkPlainText(sec.key, fw.key, answers);
      if (!frameworkText.trim()) continue;
      const parts = chunkText(frameworkText);
      for (let idx = 0; idx < parts.length; idx++) {
        allChunks.push({
          text: parts[idx]!,
          sourceName: `${sec.key}/${fw.key}`,
          chunkIndex: flatIndex++,
          sourceType: 'business_profile.framework',
        });
      }
    }
  }

  for (const doc of knowledgeDocs) {
    const extracted = extractKnowledgeDocumentText(doc);
    if (!extracted?.trim()) continue;
    const parts = chunkText(extracted);
    const baseName = doc.name || doc.id;
    for (let idx = 0; idx < parts.length; idx++) {
      allChunks.push({
        text: parts[idx]!,
        sourceName: `${doc.id}:${baseName}`,
        chunkIndex: flatIndex++,
        sourceType: 'business_knowledge_doc',
      });
    }
  }

  if (allChunks.length === 0) {
    console.log(`[EMBED] No business profile / knowledge chunks for user ${userId} (stale chunks cleared)`);
    return;
  }

  const embeddings = await embedTexts(allChunks.map((c) => c.text));

  const insertValues: string[] = [];
  const insertParams: any[] = [];
  let paramIdx = 1;

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i]!;
    const hash = sha256(chunk.text);
    const embeddingPgArray = `{${embeddings[i]!.join(',')}}`;
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}::float8[], $${paramIdx + 6})`
    );
    insertParams.push(
      userId,
      chunk.sourceType,
      chunk.sourceName,
      chunk.text,
      chunk.chunkIndex,
      embeddingPgArray,
      hash
    );
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (user_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  console.log(`[EMBED] Indexed ${allChunks.length} business profile + knowledge chunks for user ${userId}`);
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
    const embeddingPgArray = `{${embedding.join(',')}}`;
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}::float8[], $${paramIdx + 6})`
    );
    insertParams.push(sessionId, 'session_context', chunk.sourceName, chunk.text, chunk.index, embeddingPgArray, hash);
    paramIdx += 7;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (session_id, source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  console.log(`[EMBED] Indexed ${allChunks.length} session context chunks for session ${sessionId}`);
}

export interface RetrievedChunk {
  text: string;
  source_type: string;
  source_name: string;
  score: number;
}

/** Per-document cap when loading full text into the agent (characters). */
export const MAX_FULL_DOCUMENT_CHARS = 120_000;

function truncateFullDocument(text: string, maxChars = MAX_FULL_DOCUMENT_CHARS): string {
  const t = (text || '').trim();
  if (!t) return '';
  return t.length > maxChars ? `${t.slice(0, maxChars)}\n\n...[truncated]` : t;
}

/**
 * Load complete knowledge sources for the agent (no vector search).
 * Each item is one logical document with a clear title in `source_name`.
 */
export async function loadFullKnowledgeDocuments(
  personaIds: string[],
  sessionId?: string,
  userId?: string
): Promise<RetrievedChunk[]> {
  const out: RetrievedChunk[] = [];
  const seenKeys = new Set<string>();

  const push = (source_type: string, source_name: string, text: string) => {
    const body = truncateFullDocument(text);
    if (!body.trim()) return;
    const key = `${source_type}:${source_name}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    out.push({ source_type, source_name, text: body, score: 1 });
  };

  const uniquePersonaIds = [...new Set(personaIds.filter(Boolean))];
  for (const pid of uniquePersonaIds) {
    const pr = await pool.query('SELECT id, name, description FROM personas WHERE id = $1', [pid]);
    if (pr.rows.length === 0) continue;
    const { name, description } = pr.rows[0] as { name: string; description: string | null };
    const profileText = description?.trim() ? `Name: ${name}\n\n${description}` : `Name: ${name}`;
    push('full_persona_profile', `Persona profile — ${name} (name & description)`, profileText);

    const files = await pool.query(
      'SELECT name, content FROM persona_files WHERE persona_id = $1 ORDER BY name ASC',
      [pid]
    );
    for (const f of files.rows as { name: string; content: string | null }[]) {
      if (f.content && String(f.content).trim()) {
        push(
          'full_persona_file',
          `Blueprint file — ${name} / ${f.name}`,
          String(f.content)
        );
      }
    }
  }

  if (sessionId) {
    const sr = await pool.query(
      `SELECT source_name, chunk_text, chunk_index FROM knowledge_chunks
       WHERE session_id = $1 AND source_type = 'session_context'
       ORDER BY source_name ASC, chunk_index ASC`,
      [sessionId]
    );
    const byField = new Map<string, string[]>();
    for (const row of sr.rows as { source_name: string; chunk_text: string }[]) {
      const field = row.source_name || 'context';
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field)!.push(row.chunk_text);
    }
    for (const [fieldName, parts] of byField) {
      push(
        'full_session_field',
        `Simulation session input — ${fieldName}`,
        parts.join('\n\n')
      );
    }
  }

  if (userId) {
    const br = await pool.query(`SELECT answers, knowledge_documents FROM business_profiles WHERE user_id = $1`, [
      userId,
    ]);
    if (br.rows.length > 0) {
      const row = br.rows[0] as { answers: unknown; knowledge_documents: unknown };
      const answers = parseBusinessProfileAnswersJson(row.answers);
      for (const sec of BUSINESS_PROFILE_SPEC) {
        for (const fw of sec.frameworks) {
          const frameworkText = compileFrameworkPlainText(sec.key, fw.key, answers);
          if (!frameworkText.trim()) continue;
          push(
            'business_profile.framework',
            `Runner business profile — ${sec.title} / ${fw.title}`,
            frameworkText
          );
        }
      }
      const knowledgeDocs = parseKnowledgeDocumentsJson(row.knowledge_documents);
      for (const doc of knowledgeDocs) {
        const extracted = extractKnowledgeDocumentText(doc);
        if (extracted?.trim()) {
          push('full_business_knowledge_doc', `Business knowledge — ${doc.name}`, extracted);
        } else if (doc.name) {
          push(
            'full_business_knowledge_doc',
            `Business knowledge — ${doc.name} (binary)`,
            `[File on record: ${doc.name}. Use Business Profile generation or download from the Knowledge base tab to use this document.]`
          );
        }
      }
    }
  }

  return out;
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
    .filter((row: any) => row.embedding && (Array.isArray(row.embedding) ? row.embedding.length > 0 : typeof row.embedding === 'string' && row.embedding.length > 2))
    .map((row: any) => {
      let embedding: number[];
      if (Array.isArray(row.embedding)) {
        embedding = row.embedding.map(Number);
      } else if (typeof row.embedding === 'string') {
        const cleaned = row.embedding.replace(/^\{/, '[').replace(/\}$/, ']');
        embedding = JSON.parse(cleaned);
      } else {
        return null;
      }
      return {
        text: row.chunk_text,
        source_type: row.source_type,
        source_name: row.source_name,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter(Boolean) as { text: string; source_type: string; source_name: string; score: number }[];

  scored.sort((a: RetrievedChunk, b: RetrievedChunk) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Index the UI semantics corpus (UI nodes, form schemas, API routes, DB tables,
 * hand-authored workflow docs) into knowledge_chunks with NULL persona/user/session
 * scope. Idempotent on the corpus hash: if the latest stored hash matches, returns
 * `{ status: 'skipped' }` without re-embedding.
 */
export async function indexUiSemantics(
  corpus: UiSemanticsCorpus,
  options: { force?: boolean } = {}
): Promise<{ status: 'indexed' | 'skipped'; chunks: number; hash: string }> {
  if (!options.force) {
    try {
      const r = await pool.query(
        `SELECT source_name FROM knowledge_chunks
         WHERE source_type = 'ui_semantics_meta' AND persona_id IS NULL AND user_id IS NULL AND session_id IS NULL
         ORDER BY created_at DESC LIMIT 1`
      );
      const existing = r.rows[0]?.source_name as string | undefined;
      if (existing === corpus.hash) {
        console.log(`[UI_SEMANTICS] Hash ${corpus.hash.slice(0, 12)} unchanged — skipping reindex.`);
        return { status: 'skipped', chunks: 0, hash: corpus.hash };
      }
    } catch (err) {
      console.warn('[UI_SEMANTICS] Hash lookup failed; proceeding with reindex.', err);
    }
  }

  type Row = { doc: UiSemanticDoc; chunk: string; index: number };
  const rows: Row[] = [];
  for (const doc of corpus.docs) {
    const chunks = chunkText(doc.body);
    chunks.forEach((chunk, index) => rows.push({ doc, chunk, index }));
  }
  if (rows.length === 0) {
    console.warn('[UI_SEMANTICS] Corpus is empty.');
    return { status: 'indexed', chunks: 0, hash: corpus.hash };
  }

  const embeddings = await embedTexts(rows.map((r) => `${r.doc.title}\n\n${r.chunk}`));

  await pool.query(
    `DELETE FROM knowledge_chunks
     WHERE persona_id IS NULL AND user_id IS NULL AND session_id IS NULL
       AND source_type = ANY($1)`,
    [[...UI_SEMANTIC_SOURCE_TYPES, 'ui_semantics_meta']]
  );

  const insertValues: string[] = [];
  const insertParams: unknown[] = [];
  let paramIdx = 1;
  for (let i = 0; i < rows.length; i++) {
    const { doc, chunk, index } = rows[i]!;
    const embeddingPgArray = `{${embeddings[i].join(',')}}`;
    const hash = sha256(`${doc.id}:${index}:${chunk}`);
    insertValues.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}::float8[], $${paramIdx + 5})`
    );
    insertParams.push(doc.type, `${doc.id}::${doc.title}`, chunk, index, embeddingPgArray, hash);
    paramIdx += 6;
  }

  if (insertValues.length > 0) {
    await pool.query(
      `INSERT INTO knowledge_chunks (source_type, source_name, chunk_text, chunk_index, embedding, content_hash)
       VALUES ${insertValues.join(', ')}`,
      insertParams
    );
  }

  await pool.query(
    `INSERT INTO knowledge_chunks (source_type, source_name, chunk_text, chunk_index, content_hash)
     VALUES ('ui_semantics_meta', $1, $2, 0, $3)`,
    [
      corpus.hash,
      `Generated ${corpus.generatedAt} — ${corpus.docs.length} docs / ${rows.length} chunks`,
      sha256(corpus.hash),
    ]
  );

  console.log(
    `[UI_SEMANTICS] Indexed ${rows.length} chunks across ${corpus.docs.length} docs (hash=${corpus.hash.slice(0, 12)})`
  );
  return { status: 'indexed', chunks: rows.length, hash: corpus.hash };
}

/**
 * Vector retrieval restricted to the UI semantics corpus. Mirrors `retrieve` but
 * scoped to NULL persona/user/session and the new source types.
 */
export async function retrieveUiSemantics(
  query: string,
  topK = 8,
  types: UiSemanticType[] = UI_SEMANTIC_SOURCE_TYPES
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  const allowed = (types?.length ? types : UI_SEMANTIC_SOURCE_TYPES) as string[];
  const [queryEmbedding] = await embedTexts([query]);

  const result = await pool.query(
    `SELECT chunk_text, source_type, source_name, embedding FROM knowledge_chunks
     WHERE persona_id IS NULL AND user_id IS NULL AND session_id IS NULL
       AND source_type = ANY($1)`,
    [allowed]
  );

  const scored = result.rows
    .filter((row: any) => row.embedding && (Array.isArray(row.embedding) ? row.embedding.length > 0 : typeof row.embedding === 'string' && row.embedding.length > 2))
    .map((row: any) => {
      let embedding: number[];
      if (Array.isArray(row.embedding)) {
        embedding = row.embedding.map(Number);
      } else if (typeof row.embedding === 'string') {
        const cleaned = row.embedding.replace(/^\{/, '[').replace(/\}$/, ']');
        embedding = JSON.parse(cleaned);
      } else {
        return null;
      }
      return {
        text: row.chunk_text,
        source_type: row.source_type,
        source_name: row.source_name,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter(Boolean) as RetrievedChunk[];

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
