import { GoogleGenAI } from '@google/genai';
import pool from '../config/database.js';
import { retrieve, RetrievedChunk } from './embeddingService.js';

const CHAT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_CHARS = 40000;
const MAX_SYSTEM_CHARS = 200000;
/** Max think→retrieve→respond→validate cycles per user turn when validation is below threshold. */
const MAX_QUALITY_ROUNDS = 3;
const ALIGNMENT_PASS_THRESHOLD = 70;

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
  previousThinking?: string;
  image?: string;
  mimeType?: string;
}

export interface RetrievalInfo {
  queries: string[];
  chunks: { source_type: string; source_name: string; score: number; preview: string }[];
  ragEmpty: boolean;
}

export interface ValidationInfo {
  alignment_score: number;
  flags: string[];
  suggestions: string[];
}

export interface AgentTurnResult {
  response: string;
  thinking: string;
  retrieval: RetrievalInfo;
  validation: ValidationInfo | null;
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
  userMessage: string,
  simulationInstructions?: string,
  previousThinking?: string,
  retryContext?: { previousResponse: string; validation: ValidationInfo }
): Promise<{ thinking: string; searchQueries: string[] }> {
  let systemPrompt = `You are ${persona.name}, ${persona.description}.

You are about to respond to a message. Before responding, think carefully:
- What is the user really asking or trying to achieve?
- What aspects of your expertise, background, or knowledge are most relevant?
- What specific information should you look up from your knowledge base?`;

  if (retryContext) {
    const { previousResponse, validation } = retryContext;
    systemPrompt += `

### Quality revision
Your previous in-character reply scored ${validation.alignment_score}/100 on persona alignment. Refine your reasoning and retrieval plan to fix this.
${validation.flags.length ? `Concerns: ${validation.flags.map(f => `- ${f}`).join('\n')}` : ''}
${validation.suggestions.length ? `Suggestions:\n${validation.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

Previous reply (reference only—plan an improved approach):
${truncate(previousResponse, 4000)}`;
  }

  if (simulationInstructions) {
    systemPrompt += `

### Simulation context
You are participating in a simulation. Consider the following instructions when reasoning about what knowledge to retrieve and how to approach your response:
${truncate(simulationInstructions, 8000)}

Factor the simulation goals and constraints into your reasoning. Generate search queries that target knowledge relevant to this simulation scenario, not just the literal message text.`;
  }

  if (previousThinking) {
    systemPrompt += `

### Your reasoning from the previous turn
Build on your prior analysis rather than starting from scratch:
${truncate(previousThinking, 4000)}`;
  }

  systemPrompt += `

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
  mimeType?: string,
  revisionOf?: { draft: string; validation: ValidationInfo }
): Promise<string> {
  let systemPrompt = `You are ${persona.name}, ${persona.description}.
You ARE this persona. Respond in first person as them. Never describe or reference the persona—speak only as them. Stay in character.`;

  if (revisionOf) {
    const { draft, validation } = revisionOf;
    systemPrompt += `

### Revision pass
Your earlier draft scored ${validation.alignment_score}/100 on persona alignment. Produce one improved in-character reply that addresses the feedback. Do not meta-comment about the review—just speak as the persona.
${validation.flags.length ? `Issues: ${validation.flags.join('; ')}` : ''}
${validation.suggestions.length ? `Guidance: ${validation.suggestions.join('; ')}` : ''}

Earlier draft to replace (do not quote verbatim):
${truncate(draft, 4000)}`;
  }

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

async function retrieveWithRetry(
  query: string,
  personaIds: string[],
  sessionId: string | undefined,
  topK: number,
  userId: string | undefined
): Promise<RetrievedChunk[]> {
  try {
    return await retrieve(query, personaIds, sessionId, topK, userId);
  } catch (firstErr: any) {
    console.warn(`[RAG] First retrieve attempt failed, retrying once:`, firstErr?.message || firstErr);
    try {
      return await retrieve(query, personaIds, sessionId, topK, userId);
    } catch (retryErr: any) {
      console.error(`[RAG] Retry also failed:`, retryErr?.message || retryErr);
      return [];
    }
  }
}

async function appendRetrievalForQueries(
  queries: string[],
  effectivePersonaIds: string[],
  sessionId: string | undefined,
  userId: string | undefined,
  allChunks: RetrievedChunk[],
  seenTexts: Set<string>
): Promise<void> {
  for (const query of queries.slice(0, 3)) {
    const chunks = await retrieveWithRetry(query, effectivePersonaIds, sessionId, 10, userId);
    for (const chunk of chunks) {
      if (!seenTexts.has(chunk.text)) {
        seenTexts.add(chunk.text);
        allChunks.push(chunk);
      }
    }
  }
}

async function validateStep(
  ai: GoogleGenAI,
  persona: { name: string; description: string },
  response: string,
  retrievedContext: string,
  ragEmpty: boolean,
  simulationInstructions?: string
): Promise<ValidationInfo> {
  const systemPrompt = `You are a quality-assurance reviewer evaluating whether a response is authentically written from the perspective of the persona described below.

### Persona
Name: ${persona.name}
Description: ${truncate(persona.description, 4000)}

${ragEmpty ? '### WARNING\nNo knowledge chunks were retrieved for this persona. The response was generated from the persona description only, with no supporting documents.\n' : ''}
${simulationInstructions ? `### Simulation context\n${truncate(simulationInstructions, 2000)}\n` : ''}
${retrievedContext ? `### Knowledge that was available\n${truncate(retrievedContext, 4000)}\n` : ''}

### Task
Evaluate the following response for persona alignment. Consider:
- Does the tone match the persona's likely communication style?
- Does the content reflect the persona's expertise and background?
- Are there any claims that contradict the persona's profile or knowledge?
- Is the response staying in character?
${ragEmpty ? '- Factor in that no persona knowledge documents were available — the response may be generic.\n' : ''}

Output JSON only:
{
  "alignment_score": <1-100>,
  "flags": ["<specific mismatch or concern>"],
  "suggestions": ["<actionable improvement>"]
}`;

  const result = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: 'user', parts: [{ text: truncate(response, 8000) }] }],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  const text = result.text || '{}';
  try {
    const parsed = JSON.parse(text);
    return {
      alignment_score: typeof parsed.alignment_score === 'number' ? Math.min(100, Math.max(1, Math.round(parsed.alignment_score))) : 50,
      flags: Array.isArray(parsed.flags) ? parsed.flags.filter((f: unknown) => typeof f === 'string') : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: unknown) => typeof s === 'string') : [],
    };
  } catch {
    return { alignment_score: 50, flags: ['Could not parse validation response'], suggestions: [] };
  }
}

export type AgentPipelineEvent =
  | { step: 'thinking'; status: 'active' }
  | { step: 'thinking'; status: 'done'; thinking: string; searchQueries: string[] }
  | { step: 'retrieval'; status: 'active'; queries: string[] }
  | { step: 'retrieval'; status: 'done'; chunks: { source_type: string; source_name: string; score: number; preview: string }[]; ragEmpty: boolean }
  | { step: 'responding'; status: 'active' }
  | { step: 'responding'; status: 'done'; response: string }
  | { step: 'validation'; status: 'active' }
  | { step: 'validation'; status: 'done'; validation: ValidationInfo }
  | { step: 'complete'; result: AgentTurnResult };

export async function runAgentTurn(params: AgentTurnParams): Promise<AgentTurnResult> {
  return runAgentTurnStreaming(params);
}

export async function runAgentTurnStreaming(
  params: AgentTurnParams,
  emit?: (event: AgentPipelineEvent) => void
): Promise<AgentTurnResult> {
  const { personaId, personaIds, sessionId, userId, history, userMessage, simulationInstructions, previousThinking, image, mimeType } = params;
  const write = emit || (() => {});
  const ai = getAI();
  const persona = await getPersonaIdentity(personaId);
  const effectivePersonaIds = personaIds && personaIds.length > 0 ? personaIds : [personaId];

  const allChunks: RetrievedChunk[] = [];
  const seenTexts = new Set<string>();
  const queriesAccum: string[] = [];
  let thinking = '';
  let response = '';
  let validation: ValidationInfo | null = null;
  let retrievalInfo: RetrievalInfo = {
    queries: [],
    chunks: [],
    ragEmpty: true,
  };

  for (let round = 1; round <= MAX_QUALITY_ROUNDS; round++) {
    const chainThinking = round === 1 ? previousThinking : thinking;
    const retryContext =
      round > 1 && validation
        ? { previousResponse: response, validation }
        : undefined;

    write({ step: 'thinking', status: 'active' });
    const thinkOut = await thinkStep(
      ai,
      persona,
      history,
      userMessage,
      simulationInstructions,
      chainThinking,
      retryContext
    );
    thinking = thinkOut.thinking;
    const searchQueries = thinkOut.searchQueries;
    write({ step: 'thinking', status: 'done', thinking, searchQueries });

    const queries = searchQueries.length > 0 ? searchQueries : [userMessage];
    for (const q of queries) {
      if (!queriesAccum.includes(q)) queriesAccum.push(q);
    }

    write({ step: 'retrieval', status: 'active', queries });
    await appendRetrievalForQueries(queries, effectivePersonaIds, sessionId, userId, allChunks, seenTexts);

    if (allChunks.length === 0 && persona.description) {
      const fallbackQuery = `${persona.name} ${truncate(persona.description, 200)}`;
      if (!queriesAccum.includes(fallbackQuery)) queriesAccum.push(fallbackQuery);
      const fallbackChunks = await retrieveWithRetry(fallbackQuery, effectivePersonaIds, sessionId, 10, userId);
      for (const chunk of fallbackChunks) {
        if (!seenTexts.has(chunk.text)) {
          seenTexts.add(chunk.text);
          allChunks.push(chunk);
        }
      }
    }

    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, 15);
    const ragEmpty = topChunks.length === 0;
    const retrievedContext = buildRetrievedContextSection(topChunks);
    retrievalInfo = {
      queries: [...queriesAccum],
      chunks: topChunks.map(c => ({
        source_type: c.source_type,
        source_name: c.source_name,
        score: c.score,
        preview: truncate(c.text, 150),
      })),
      ragEmpty,
    };
    write({ step: 'retrieval', status: 'done', chunks: retrievalInfo.chunks, ragEmpty });

    const revisionOf =
      round > 1 && validation ? { draft: response, validation } : undefined;

    write({ step: 'responding', status: 'active' });
    response = await respondStep(
      ai,
      persona,
      history,
      userMessage,
      thinking,
      retrievedContext,
      simulationInstructions,
      image,
      mimeType,
      revisionOf
    );
    write({ step: 'responding', status: 'done', response });

    write({ step: 'validation', status: 'active' });
    try {
      validation = await validateStep(ai, persona, response, retrievedContext, ragEmpty, simulationInstructions);
    } catch (err: any) {
      console.error(`[Validation] Failed:`, err?.message || err);
      validation = null;
    }
    const validationDone = validation || {
      alignment_score: 50,
      flags: ['Validation unavailable'],
      suggestions: [],
    };
    write({ step: 'validation', status: 'done', validation: validationDone });
    validation = validationDone;

    if (validation.alignment_score >= ALIGNMENT_PASS_THRESHOLD) {
      break;
    }
  }

  const result: AgentTurnResult = { response, thinking, retrieval: retrievalInfo, validation };
  write({ step: 'complete', result });
  return result;
}
