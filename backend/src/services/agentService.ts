import { GoogleGenAI } from '@google/genai';
import pool from '../config/database.js';
import { retrieve, RetrievedChunk } from './embeddingService.js';

const CHAT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_CHARS = 40000;
const MAX_SYSTEM_CHARS = 200000;

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('${') || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured. Set a valid key in backend/.env');
  }
  return new GoogleGenAI({ apiKey });
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '... [truncated]' : text;
}

export interface AgentTurnParams {
  personaId: string;
  personaIds?: string[];
  sessionId?: string;
  userId?: string;
  history: { role: 'user' | 'model'; text: string }[];
  userMessage: string;
  simulationInstructions?: string;
  image?: string;
  mimeType?: string;
}

export interface AgentTurnResult {
  response: string;
  thinking: string;
}

async function getPersonaIdentity(personaId: string): Promise<{ name: string; description: string }> {
  const result = await pool.query(
    'SELECT name, description FROM personas WHERE id = $1',
    [personaId]
  );
  if (result.rows.length === 0) throw new Error(`Persona ${personaId} not found`);
  return result.rows[0];
}

async function thinkStep(
  ai: GoogleGenAI,
  persona: { name: string; description: string },
  history: { role: 'user' | 'model'; text: string }[],
  userMessage: string
): Promise<{ thinking: string; searchQueries: string[] }> {
  const systemPrompt = `You are ${persona.name}, ${persona.description}.

You are about to respond to a message. Before responding, think carefully:
- What is the user really asking or trying to achieve?
- What aspects of your expertise, background, or knowledge are most relevant?
- What specific information should you look up from your knowledge base?

Output your thinking in JSON:
{
  "thinking": "your step-by-step reasoning here",
  "search_queries": ["query 1", "optional query 2"]
}`;

  const contents = [
    ...history.slice(-10).map(h => ({
      role: h.role,
      parts: [{ text: truncate(h.text, 5000) }],
    })),
    { role: 'user' as const, parts: [{ text: truncate(userMessage, 10000) }] },
  ];

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '{}';
  try {
    const parsed = JSON.parse(text);
    return {
      thinking: parsed.thinking || '',
      searchQueries: Array.isArray(parsed.search_queries) ? parsed.search_queries : [],
    };
  } catch {
    return { thinking: text, searchQueries: [] };
  }
}

function buildRetrievedContextSection(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';
  const lines = chunks.map((c) => {
    let label: string;
    if (c.source_type === 'file') label = `[File: ${c.source_name}]`;
    else if (c.source_type === 'profile') label = '[Profile]';
    else if (c.source_type === 'business_profile') label = '[Business Context]';
    else label = `[Context: ${c.source_name}]`;
    return `${label}\n${c.text}`;
  });
  return '### Retrieved knowledge\n\n' + lines.join('\n\n---\n\n');
}

async function respondStep(
  ai: GoogleGenAI,
  persona: { name: string; description: string },
  history: { role: 'user' | 'model'; text: string }[],
  userMessage: string,
  thinking: string,
  retrievedContext: string,
  simulationInstructions?: string,
  image?: string,
  mimeType?: string
): Promise<string> {
  let systemPrompt = `You are ${persona.name}, ${persona.description}.
You ARE this persona. Respond in first person as them. Never describe or reference the persona—speak only as them. Stay in character.`;

  if (simulationInstructions) {
    systemPrompt += `\n\n### Simulation instructions\n${simulationInstructions}`;
  }

  if (thinking) {
    systemPrompt += `\n\n### Your earlier analysis\n${thinking}`;
  }

  if (retrievedContext) {
    systemPrompt += `\n\n${retrievedContext}`;
  }

  systemPrompt = truncate(systemPrompt, MAX_SYSTEM_CHARS);

  const userParts: any[] = [{ text: truncate(userMessage, 20000) }];
  if (image && mimeType) {
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    userParts.push({
      inlineData: { data: base64Data, mimeType },
    });
  }

  const contents = [
    ...history.map(h => ({
      role: h.role,
      parts: [{ text: truncate(h.text, 10000) }],
    })),
    { role: 'user' as const, parts: userParts },
  ];

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  return response.text || '';
}

export async function runAgentTurn(params: AgentTurnParams): Promise<AgentTurnResult> {
  const { personaId, personaIds, sessionId, userId, history, userMessage, simulationInstructions, image, mimeType } = params;
  const ai = getAI();
  const persona = await getPersonaIdentity(personaId);

  const effectivePersonaIds = personaIds && personaIds.length > 0 ? personaIds : [personaId];

  // Step 1: Think
  const { thinking, searchQueries } = await thinkStep(ai, persona, history, userMessage);

  // Step 2: Retrieve (non-fatal -- if retrieval fails, respond without RAG context)
  let retrievedContext = '';
  try {
    const queries = searchQueries.length > 0 ? searchQueries : [userMessage];
    const allChunks: RetrievedChunk[] = [];
    const seenTexts = new Set<string>();

    for (const query of queries.slice(0, 3)) {
      const chunks = await retrieve(query, effectivePersonaIds, sessionId, 10, userId);
      for (const chunk of chunks) {
        if (!seenTexts.has(chunk.text)) {
          seenTexts.add(chunk.text);
          allChunks.push(chunk);
        }
      }
    }

    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, 15);
    retrievedContext = buildRetrievedContextSection(topChunks);
  } catch (retrievalErr: any) {
    console.error(`[RAG] Retrieval failed, responding without embedded context:`, retrievalErr?.message || retrievalErr);
  }

  // Step 3: Respond
  const response = await respondStep(
    ai,
    persona,
    history,
    userMessage,
    thinking,
    retrievedContext,
    simulationInstructions,
    image,
    mimeType
  );

  return { response, thinking };
}
