import { GoogleGenAI } from "@google/genai";
import type { CreateSimulationRequest } from "./simulationTemplateApi.js";
import { sanitizeDraft, type SimulationDraft } from "./simulationDraft.js";
import { sanitizePersonaBuildDraft, type PersonaBuildDraft } from "./personaBuildDraft.js";
import {
  sanitizeSimulationRunDraft,
  type SimulationRunDraft,
  type SimulationRunDraftContext,
} from "./simulationRunDraft.js";
import {
  BUSINESS_PROFILE_SPEC,
  businessProfileAnswerKey,
  getAnswerKeysForSection,
  getBusinessProfileAllowedAnswerKeySet,
  type BusinessProfileSectionKey,
} from '../constants/businessProfileSpec.js';
import { parseLastPersuasionPercentFromText } from "../utils/persuasionScore.js";
import { normalizeUsageMetadata } from '../utils/geminiUsage.js';
import { tokenUsageStore, type TokenUsageBucket } from './tokenUsageStore.js';

export type { TokenUsageBucket } from './tokenUsageStore.js';

function recordGeminiResponseUsage(response: { usageMetadata?: unknown }, bucket: TokenUsageBucket): void {
  tokenUsageStore.addUsage(bucket, normalizeUsageMetadata(response.usageMetadata));
}

const MAX_PART_CHARS = 500000;
const MAX_SYSTEM_CHARS = 200000;

/** MIME types supported by Gemini for inline data (images, PDF, and other documents). */
export const GEMINI_ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain',
  'text/csv',
  'application/json',
] as const;

/** Accept attribute value for file inputs that should accept any file type Gemini supports. */
export const GEMINI_FILE_INPUT_ACCEPT =
  '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/png,image/jpeg,image/webp,image/gif,image/heic,text/plain,text/csv,application/json';

/** Per-type description of expected output and behavior; passed when generating the system prompt. */
export const SIMULATION_TYPE_OUTPUT_SPECS: Record<string, string> = {
  report:
    'Strict output: A single downloadable report from the {{SELECTED_PROFILE_FULL}} perspective. Exactly one paragraph of reasoning (or summary), then the full report in a structured/column format as human-readable plain text (headings, paragraphs, simple tables as text—never JSON, YAML, XML, or ```json blocks). No chat. No follow-up. Read-only output only.',
  persuasion_simulation:
    'Strict output: Back-and-forth chat in natural language only—never JSON, YAML, XML, or fenced code blocks for messages. At the end, the persona MUST state exactly one line: \'Persuasion: N%\' where N is an integer from 1 to 100 indicating how persuaded the agent is. Example: \'Persuasion: 75%\'. The score must be convincing and between 1-100. The UI displays this as the persuasion result. No other structured output—conversation plus this final line.',
  response_simulation:
    'Strict output: Exactly one response as plain sentences and labels—never JSON, YAML, XML, or ```json. Must include: (1) the confidence level (e.g. percentage or score), (2) the single output—for numeric type always give a number AND its unit (e.g. "45 minutes", "$1,200", "75%"); for action/text give the chosen action or text answer—and (3) at most one paragraph of reasoning. No chat. No further interaction.',
  survey:
    'Strict output: Survey results only, as plain text. Do NOT write any "Summary:" lines or overall summary—the app adds that separately. For each survey question in order use exactly: "Question: <full question text>", then "Answer: <full in-character answer>", then one blank line before the next question block. Do NOT output JSON, YAML, XML, or markdown code fences. No chat. No follow-up conversation.',
  persona_conversation:
    'Moderated multi-persona conversation. Multiple personas discuss an opening line in turns; an LLM moderator decides who speaks next and when the conversation ends. Each persona responds in a separate call with full conversation context—plain dialogue only, never JSON or XML payloads. After the conversation (or after max 20 persona turns), the moderator summarizes and answers the opening line in plain text. No user chat—conversation is persona-to-persona only.',
  idea_generation:
    'Strict output: Exactly one response. Output MUST be a bullet list of ideas only (use "- " or "* " at the start of each line). No JSON, YAML, XML, or code fences—bullets of plain text only. No introductory paragraph, no chat, no follow-up. The number of ideas is specified in the configuration; output exactly that many bullet points.',
};

const truncate = (text: string, max: number) => {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "... [Truncated for Context]" : text;
};

const extractJson = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from response:", text);
    throw new Error("Invalid intelligence response format. Ensure you are providing actual text content, not just a link.");
  }
};

/** Detect 503/502/504 or UNAVAILABLE and throw a user-friendly message so callers don't suggest API key/quota. */
function throwIfServiceUnavailable(error: any, defaultMessage: string): void {
  const status = error?.status ?? error?.statusCode ?? error?.code ?? error?.error?.code;
  const msg = (error?.message ?? '') + (typeof error?.error === 'object' ? JSON.stringify(error.error) : '');
  const is503 = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('currently unavailable');
  const is502 = status === 502 || msg.includes('502');
  const is504 = status === 504 || msg.includes('504');
  if (is503 || is502 || is504) {
    throw new Error(
      `Google's Gemini API is temporarily unavailable (${status || 'service error'}). This is usually on Google's side, not your API key or quota.\n\n` +
      'Please try again in a few minutes. You can check status at https://status.cloud.google.com'
    );
  }
}

/** Check if error is retryable (503, 502, 504, UNAVAILABLE). */
function isRetryableError(error: any): boolean {
  const status = error?.status ?? error?.statusCode ?? error?.code ?? error?.error?.code;
  const msg = (error?.message ?? '') + (typeof error?.error === 'object' ? JSON.stringify(error.error) : '');
  return (
    status === 503 || status === 502 || status === 504 ||
    msg.includes('503') || msg.includes('502') || msg.includes('504') ||
    msg.includes('UNAVAILABLE') || msg.includes('currently unavailable')
  );
}

/** Retry an async operation on 503/502/504 with exponential backoff (for simulation resilience). */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === maxRetries) throw err;
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(`Gemini API temporarily unavailable, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export type BusinessProfileSectionSource = {
  companyHint?: string;
  /** Combined plain text from text files or pasted content. */
  textCorpus?: string;
  /** Binary uploads (PDF, images, Word, etc.); `data` may be data URL or raw base64. */
  inlineFiles?: { data: string; mimeType: string; name?: string }[];
  /** Current saved answers for this section only (keys = section.framework.question). Used for conservative merge. */
  existingAnswers?: Record<string, string>;
};

const BP_EXISTING_VALUE_PROMPT_MAX = 3500;
/** Max chars of plain-text corpus sent to the section-router prompt. */
const BP_ROUTE_TEXT_MAX = 16000;

function sliceExistingAnswersForKeys(
  existing: Record<string, string> | undefined,
  keys: string[]
): Record<string, string> {
  if (!existing) return {};
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = existing[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

function formatBusinessProfileCurrentValuesBlock(
  keys: string[],
  labelByKey: Record<string, string>,
  existing: Record<string, string> | undefined
): string {
  const sliced = sliceExistingAnswersForKeys(existing, keys);
  if (Object.keys(sliced).length === 0) return '';
  const lines: string[] = [
    '',
    '## CURRENT VALUES (user profile — treat as authoritative by default; long text may be truncated)',
  ];
  for (const k of keys) {
    const cur = sliced[k];
    if (!cur) continue;
    const label = labelByKey[k] ?? k;
    lines.push(`### ${k} (${label})`);
    lines.push(truncate(cur, BP_EXISTING_VALUE_PROMPT_MAX));
  }
  return lines.join('\n');
}

function formatBusinessProfileExistingSummaryForVoice(existing: Record<string, string> | undefined): string {
  if (!existing) return '';
  const entries = Object.entries(existing)
    .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : ''] as const)
    .filter(([, v]) => v.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';
  const lines: string[] = ['## CURRENT PROFILE (non-empty fields only; truncated)', ''];
  for (const [k, v] of entries) {
    lines.push(`### ${k}`);
    lines.push(truncate(v, BP_EXISTING_VALUE_PROMPT_MAX));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function mergeCertaintyBlockDocumentBacked(): string {
  return `MERGE + CERTAINTY (together with RULES above):
- **Evidence bar:** For each key, every factual claim in a non-null value must be traceable to explicit wording or a direct, verifiable entailment from the provided files or plain-text excerpts in this request. If you cannot meet that bar, use JSON null for that key—even if CURRENT VALUES for that key is empty.
- **Preserve when no new fact:** If CURRENT VALUES has text for a key and the materials do not add any **new**, **explicit** fact for that key, use JSON null (leave the field unchanged on the client).
- **Additive merge:** If materials add a new explicit fact that does **not** contradict CURRENT, return the **full merged** text: keep applicable prior text and integrate the new fact in plain language without filler. If you are unsure whether facts contradict, use JSON null for that key.
- **Replace only on clear conflict:** Replace or substantially edit CURRENT only when the materials **explicitly** contradict it and the corrected text is **directly** stated or unmistakably implied by the materials. If the conflict is unclear or arguable, use JSON null.
- **No invention from hints alone:** Do not use the company identifier or general web knowledge to fabricate content when materials are attached; materials and excerpts are the primary evidence.`;
}

function mergeCertaintyBlockNoDocument(hint: boolean): string {
  if (hint) {
    return `MERGE + CERTAINTY (together with RULES above):
- **Existing text:** When CURRENT VALUES has text for a key, use JSON null unless reliable general knowledge supports a **specific** factual update with **very high** confidence. When in doubt, use JSON null and keep the prior answer.
- **Additive / replace:** Only output non-null text when the update is clearly factual and non-speculative. If the new text would contradict CURRENT without explicit support from general knowledge, use JSON null.
- Treat CURRENT as authoritative when any update would be vague, stylistic, or assumed.`;
  }
  return `MERGE + CERTAINTY:
- When CURRENT VALUES has text for a key, use JSON null unless you can answer from industry-agnostic guidance without implying a specific entity. Prefer null over weak guesses.`;
}

async function runBusinessProfileGeneration(
  prompt: string,
  source: BusinessProfileSectionSource,
  usageBucket: TokenUsageBucket = 'business_profile'
): Promise<string | object> {
  const textCorpus = (source.textCorpus ?? '').trim();
  const inlineFiles = (source.inlineFiles ?? []).filter((f) => f.data && f.mimeType);

  if (inlineFiles.length > 0) {
    let fullPrompt = prompt;
    if (textCorpus) {
      fullPrompt += `\n\n--- Plain-text sources (from text files or pasted content) ---\n${truncate(textCorpus, 80000)}`;
    }
    const names = inlineFiles.map((f, i) => f.name?.trim() || `document-${i + 1}`).join(', ');
    fullPrompt += `\n\nThe user attached ${inlineFiles.length} file(s) as inline media (${names}). Use every attachment as source material; reconcile overlaps consistently.`;

    const [first, ...rest] = inlineFiles;
    return await geminiService.runSimulation(fullPrompt, first.data, first.mimeType, rest, usageBucket);
  }

  if (textCorpus) {
    const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${truncate(textCorpus, 100000)}`;
    return await geminiService.generateBasic(fullPrompt, true, usageBucket);
  }

  return await geminiService.generateBasic(prompt, true, usageBucket);
}

/** Treat model placeholder prose as empty so merges do not overwrite real answers. */
function scrubBusinessProfilePlaceholderAnswer(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (
    /^(n\/a|n\.a\.|na|not applicable|not specified|not available|no information|unknown|undefined|tbd|tbc|—|-|\.{3,})$/i.test(
      t,
    )
  ) {
    return null;
  }
  return t;
}

function normalizeBusinessProfileResult(rawResult: string | object, keys: string[]): Record<string, string | null> {
  const parsed = typeof rawResult === 'string'
    ? (() => {
        const cleaned = rawResult.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1').trim();
        try {
          return JSON.parse(cleaned);
        } catch {
          return JSON.parse(rawResult);
        }
      })()
    : rawResult;
  const result: Record<string, string | null> = {};
  for (const k of keys) {
    const v = parsed[k];
    if (v === undefined || v === null) {
      result[k] = null;
    } else {
      result[k] = scrubBusinessProfilePlaceholderAnswer(String(v));
    }
  }
  return result;
}

/** Sparse Business Profile fill from natural language (voice assistant bar). */
export type BusinessProfileVoiceDraft = {
  routing_rationale: string;
  filled: Record<string, string>;
  notes: string[];
};

const BP_VOICE_FIELD_MAX_CHARS = 16000;

function buildBusinessProfileKeyCatalogForPrompt(): string {
  const lines: string[] = [];
  for (const sec of BUSINESS_PROFILE_SPEC) {
    lines.push(`### ${sec.title} [section key: ${sec.key}]`);
    for (const fw of sec.frameworks) {
      lines.push(`  Framework: ${fw.title} (${fw.key})`);
      for (const q of fw.questions) {
        const k = businessProfileAnswerKey(sec.key, fw.key, q.key);
        lines.push(`  - "${k}": ${q.label}`);
      }
    }
  }
  return lines.join('\n');
}

function sanitizeBusinessProfileVoiceDraft(parsed: unknown): BusinessProfileVoiceDraft {
  const allowed = getBusinessProfileAllowedAnswerKeySet();
  const filled: Record<string, string> = {};
  const rawFilled =
    parsed &&
    typeof parsed === 'object' &&
    parsed !== null &&
    'filled' in parsed &&
    typeof (parsed as { filled: unknown }).filled === 'object' &&
    (parsed as { filled: unknown }).filled !== null &&
    !Array.isArray((parsed as { filled: unknown }).filled)
      ? ((parsed as { filled: Record<string, unknown> }).filled as Record<string, unknown>)
      : null;
  if (rawFilled) {
    for (const [k, v] of Object.entries(rawFilled)) {
      if (!allowed.has(k)) continue;
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s) continue;
      filled[k] = s.length > BP_VOICE_FIELD_MAX_CHARS ? s.slice(0, BP_VOICE_FIELD_MAX_CHARS) : s;
    }
  }
  let routing_rationale = '';
  if (parsed && typeof parsed === 'object' && parsed !== null && 'routing_rationale' in parsed) {
    const r = (parsed as { routing_rationale: unknown }).routing_rationale;
    if (typeof r === 'string') routing_rationale = r.trim().slice(0, 2000);
  }
  const notes: string[] = [];
  if (parsed && typeof parsed === 'object' && parsed !== null && 'notes' in parsed) {
    const n = (parsed as { notes: unknown }).notes;
    if (Array.isArray(n)) {
      for (const item of n) {
        if (typeof item === 'string' && item.trim()) notes.push(item.trim().slice(0, 500));
      }
    }
  }
  return { routing_rationale, filled, notes };
}

export const geminiService = {
  generateBasic: async (
    prompt: string,
    isJson: boolean = false,
    usageBucket?: TokenUsageBucket
  ): Promise<any> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: truncate(prompt, MAX_PART_CHARS),
      });
      if (usageBucket) recordGeminiResponseUsage(response, usageBucket);
      const text = response.text || "";
      return isJson ? extractJson(text) : text;
    } catch (error: any) {
      console.error('Gemini API error details:', {
        message: error?.message,
        status: error?.status,
        statusCode: error?.statusCode,
        code: error?.code,
        fullError: error
      });
      
      // Check if it's a 404 error
      if (error?.status === 404 || error?.statusCode === 404 || error?.message?.includes('404') || error?.code === 404) {
        throw new Error(`Gemini API 404 Error: Model not found. Available models include: gemini-2.5-flash, gemini-2.5-pro\n\nThis could mean:\n1. The model name is incorrect\n2. Your API key doesn't have access to this model\n3. The API endpoint is incorrect\n\nPlease verify your API key at https://aistudio.google.com/apikey\n\nFull error: ${error?.message || JSON.stringify(error)}`);
      }
      
      // Check if it's a quota/rate limit error
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('free_tier')) {
          throw new Error(`Free Tier Quota Exceeded: You've reached the daily limit of 20 requests per day for the Gemini API free tier.\n\nOptions:\n1. Wait until the quota resets (daily limit)\n2. Upgrade to a paid API key for higher limits\n\nCheck your usage: https://aistudio.google.com/app/apikey\n\nFull error: ${errorMsg}`);
        }
        throw new Error(`Rate Limit Exceeded: ${errorMsg}\n\nPlease retry after the specified delay.`);
      }
      
      throwIfServiceUnavailable(error, 'Failed to generate content.');
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate content. Please check your API key and quota.'}`);
    }
  },

  /**
   * Generate a realistic full name for a persona (e.g. for a job title or "advisor").
   * Returns a single string "First Last". Uses AI so no fixed default name list.
   */
  generatePersonaName: async (context: string): Promise<string> => {
    const prompt = `Generate a plausible, invented full name (first and last name only) for a person who might have this role. Return only valid JSON: {"name": "First Last"}. The value for "name" must be a real-sounding human name (e.g. "Sarah Chen", "Marcus Webb"), never a job title or role (e.g. not "Project Lead", "Marketing Director", or "Advisor"). Context/role: ${context}`;
    try {
      const parsed = await geminiService.generateBasic(prompt, true, 'build_personas');
      const name = typeof parsed?.name === 'string' ? parsed.name.trim() : '';
      if (name.length > 0) return name;
    } catch (e) {
      console.warn('generatePersonaName failed, using generic fallback', e);
    }
    return 'Persona';
  },

  /**
   * Specifically for extracting raw facts from messy source data like LinkedIn text.
   */
  extractFacts: async (sourceData: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      TASK: Extract every specific professional fact from the following text.
      SOURCE: ${truncate(sourceData, 50000)}
      
      EXTRACT THE FOLLOWING:
      - Full Name and Current Title
      - Exact companies and years worked
      - Specific projects or achievements mentioned
      - Key skills and technologies
      - Educational background
      - Tone of voice used in their 'About' or posts
      
      RULES:
      - If the source is just a URL, state "NO TEXT DATA PROVIDED - ONLY A LINK".
      - Only list facts present in the text.
      - Do not hallucinate details.
    `;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      recordGeminiResponseUsage(response, 'build_personas');
      return response.text || "No facts extracted.";
    } catch (error: any) {
      console.error('Gemini API error:', error);
      
      // Check if it's a quota/rate limit error
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('free_tier')) {
          throw new Error(`Free Tier Quota Exceeded: You've reached the daily limit of 20 requests per day.\n\nOptions:\n1. Wait until the quota resets (daily limit)\n2. Upgrade to a paid API key\n\nCheck usage: https://aistudio.google.com/app/apikey`);
        }
        throw new Error(`Rate Limit Exceeded: ${errorMsg}`);
      }
      
      throwIfServiceUnavailable(error, 'Failed to extract facts.');
      throw new Error(`Gemini API error: ${error?.message || 'Failed to extract facts. Please check your API key and quota.'}`);
    }
  },

  /**
   * Rewrite rough notes into LinkedIn-style profile text so the same advisor pipeline
   * (extractFacts → identity → high-fidelity blueprint) as pasted LinkedIn can run.
   */
  improveAdvisorSourceMaterial: async (rawNotes: string): Promise<string> => {
    const trimmed = rawNotes.trim();
    if (!trimmed) {
      throw new Error('Add some text about the expert before using Improve.');
    }
    const prompt = `You prepare source material for an automated "expert advisor" persona builder. That system is tuned for pasted LinkedIn profile text, then structured fact extraction.

The user provided informal notes about a professional expert (bullets, fragments, interview notes, or a short bio). Rewrite their input into ONE cohesive plain-text document that resembles what you would get by selecting all text on a LinkedIn profile page:

- Use clear sections when content supports it: Summary/About, Experience, Education, Skills, Certifications, etc.
- Preserve every factual claim from the user's notes. Do not invent employers, dates, titles, degrees, metrics, or achievements that are not clearly supported by the notes.
- You may fix grammar, connect fragments, and clarify phrasing. If something is vague, keep it vague rather than guessing specifics.
- If the notes describe domain expertise without a named person, write a rich expert profile consistent with the notes without inventing a fake personal name in the document.
- If the input is only a URL line or too short to profile, output a short paragraph stating that full pasted text is needed—do not fabricate a profile.

USER NOTES:
${truncate(trimmed, 50000)}

Output ONLY the improved profile text. No title line like "Here is" or markdown code fences.`;

    const out = await geminiService.generateBasic(prompt, false, 'build_personas');
    return (out || '').trim();
  },

  generateAvatar: async (name: string, title: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      // Return fallback avatar if API key is not configured
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=256&bold=true`;
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `A clean, high-quality 2D cartoon face avatar of a ${title} named ${name}. Modern flat design style, friendly professional expression, centered, solid soft-colored background, vibrant colors, simplified features.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });
      recordGeminiResponseUsage(response, 'build_personas');

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error("Image generation failed", e);
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=256&bold=true`;
  },

  generateChain: async (templateContent: string, inputs: Record<string, string>, useExtendedThinking: boolean = false, temperature?: number): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
    // Always use gemini-2.5-flash since gemini-2.5-pro is not available on free tier
    const model = 'gemini-2.5-flash';
    
    let contextString = "";
    for (const [key, value] of Object.entries(inputs)) {
      contextString += `### SOURCE DATA [${key}]:\n${truncate(value, 100000)}\n\n`;
    }

    const prompt = `
      ROLE: High-Fidelity Persona Architect.
      
      STRICT REQUIREMENT: You are creating a persona based ON THE PROVIDED SOURCE DATA ONLY. 
      If a LinkedIn profile text is provided, you must capture the specific career path, 
      actual companies, and unique personality traits found in that text.
      
      DO NOT USE GENERIC ADVICE OR "PLACEHOLDER" CORPORATE SPEAK.
      
      TEMPLATE TO FILL:
      ${templateContent}
      
      RAW SOURCE DATA (THE ONLY SOURCE OF TRUTH):
      ${contextString}
      
      INSTRUCTIONS:
      1. Map the specific professional history from the SOURCE DATA into the template.
      2. If a fact is missing from the source, leave the template field minimal rather than inventing details.
      3. Capture the 'Voice' of the individual as evidenced by their writing style in the source.
      4. Output the full Markdown document.
    `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        ...(temperature !== undefined && temperature !== null ? { config: { temperature } } : {}),
      });
      recordGeminiResponseUsage(response, 'build_personas');

      return response.text || "";
    } catch (error: any) {
      console.error('Gemini API error:', error);
      
      // Check if it's a quota/rate limit error
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('free_tier')) {
          throw new Error(`Free Tier Quota Exceeded: You've reached the daily limit of 20 requests per day for the Gemini API free tier.\n\nOptions:\n1. Wait until the quota resets (daily limit)\n2. Upgrade to a paid API key for higher limits\n3. Reduce the number of personas being generated\n\nCheck your usage: https://aistudio.google.com/app/apikey\n\nFull error: ${errorMsg}`);
        }
        throw new Error(`Rate Limit Exceeded: ${errorMsg}\n\nPlease retry after the specified delay.`);
      }
      
      throwIfServiceUnavailable(error, 'Failed to generate chain.');
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate chain. Please check your API key and quota.'}`);
    }
  },

  /**
   * Run a specialized simulation with optional multi-modal input.
   * Uses retry with exponential backoff on 503/502/504 for resilience.
   */
  runSimulation: async (
    prompt: string,
    imageData?: string,
    mimeType?: string,
    extraInlineFiles?: { data: string; mimeType: string }[],
    usageBucket: TokenUsageBucket = 'build_personas'
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: prompt }];

    const pushInline = (rawData: string, mt: string) => {
      let base64Data: string;
      if (rawData.includes(',')) {
        base64Data = rawData.split(',')[1];
      } else {
        base64Data = rawData;
      }
      if (!base64Data || base64Data.trim().length === 0) {
        throw new Error('Invalid file data: base64 content is empty. Please ensure the file is valid and not corrupted.');
      }
      if (!/^[A-Za-z0-9+/=]+$/.test(base64Data.replace(/\s/g, ''))) {
        throw new Error('Invalid file data: base64 format appears to be invalid. Please try uploading the file again.');
      }
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mt,
        },
      });
    };

    if (imageData && mimeType) {
      pushInline(imageData, mimeType);
    }
    for (const f of extraInlineFiles ?? []) {
      if (f.data && f.mimeType) pushInline(f.data, f.mimeType);
    }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
      });
      recordGeminiResponseUsage(response, usageBucket);

      return response.text || "";
    } catch (error: any) {
      console.error('Gemini API error:', error);
      
      // Check for document/file errors (e.g. empty, invalid, unsupported type)
      if (error?.status === 400 || error?.code === 400 || error?.message?.includes('400')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('no pages') || errorMsg.includes('invalid') || errorMsg.includes('empty') || errorMsg.includes('Unsupported') || errorMsg.includes('MIME')) {
          throw new Error(`File Error: The document or file appears to be empty, corrupted, invalid, or an unsupported type.\n\nPlease ensure:\n1. The file is not corrupted\n2. The file type is supported (e.g. PDF, images, text)\n3. The file is not password-protected\n4. The file size is reasonable (under 20MB)\n\nOriginal error: ${errorMsg}`);
        }
        throw new Error(`Invalid Request: ${errorMsg}`);
      }
      
      // Check if it's a quota/rate limit error
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('free_tier')) {
          throw new Error(`Free Tier Quota Exceeded: Daily limit of 20 requests reached.\n\nOptions:\n1. Wait until quota resets\n2. Upgrade to paid API key\n\nCheck usage: https://aistudio.google.com/app/apikey`);
        }
        throw new Error(`Rate Limit Exceeded: ${errorMsg}`);
      }
      
      throwIfServiceUnavailable(error, 'Failed to run simulation.');
      throw new Error(`Gemini API error: ${error?.message || 'Failed to run simulation. Please check your API key and quota.'}`);
    }
    });
  },

  /**
   * From plain-text excerpts (plus optional filenames), pick which Business Profile section tabs
   * plausibly relate to the material. Returns keys in spec order.
   * When there is no text excerpt (e.g. PDF-only uploads), returns all six sections so each file-backed pass still runs.
   */
  routeBusinessProfileSectionKeys: async (
    source: BusinessProfileSectionSource
  ): Promise<BusinessProfileSectionKey[]> => {
    const allOrdered = BUSINESS_PROFILE_SPEC.map((s) => s.key);
    const textCorpus = (source.textCorpus ?? '').trim();
    const hasFiles = (source.inlineFiles?.length ?? 0) > 0;
    const hasMaterial = Boolean(textCorpus) || hasFiles;
    if (!hasMaterial) return allOrdered;

    if (!textCorpus) {
      return allOrdered;
    }

    const hint = source.companyHint?.trim();
    const sectionLines = BUSINESS_PROFILE_SPEC.map(
      (s) => `- "${s.key}": ${s.title} (${s.shortLabel})`
    ).join('\n');

    const names =
      hasFiles && source.inlineFiles
        ? source.inlineFiles.map((f, i) => f.name?.trim() || `file-${i + 1}`).join(', ')
        : '';
    const fileNote = hasFiles
      ? `The user also attached ${source.inlineFiles!.length} file(s): ${names}. You do not see file contents—use filenames only as weak hints. When in doubt, **include** the section.`
      : '';

    const prompt = `You map business materials to profile **section** themes (high-level tabs, not individual form fields).

## Plain-text excerpt (may be truncated)
${truncate(textCorpus, BP_ROUTE_TEXT_MAX)}
${hint ? `\nCompany / disambiguation hint: "${hint}"` : ''}
${fileNote ? `\n${fileNote}` : ''}

## Sections (exact keys)
${sectionLines}

## Task
Return ONE JSON object only: { "sections": [ "<key>", ... ] }

Include every section key from the list where the excerpt (and filenames, weakly) could plausibly inform **any part** of that section. **Err toward including** a section when overlap is plausible.

**Exclude** a key from the array only when the material is clearly irrelevant to that entire theme.

Allowed keys only: ${BUSINESS_PROFILE_SPEC.map((s) => `"${s.key}"`).join(', ')}`;

    try {
      const raw = await geminiService.generateBasic(prompt, true, 'business_profile');
      const arr =
        raw &&
        typeof raw === 'object' &&
        raw !== null &&
        'sections' in raw &&
        Array.isArray((raw as { sections: unknown }).sections)
          ? (raw as { sections: unknown[] }).sections
          : null;
      if (!arr || arr.length === 0) return allOrdered;
      const allowed = new Set(BUSINESS_PROFILE_SPEC.map((s) => s.key));
      const picked = new Set<string>();
      for (const item of arr) {
        if (typeof item === 'string' && allowed.has(item)) picked.add(item);
      }
      if (picked.size === 0) return allOrdered;
      return allOrdered.filter((k) => picked.has(k));
    } catch {
      return allOrdered;
    }
  },

  /**
   * Fill one Business Profile section (tab) from a document / company hint.
   * Keys are full answer slugs: section.framework.question
   */
  generateBusinessProfileSection: async (
    sectionKey: BusinessProfileSectionKey,
    source: BusinessProfileSectionSource = {}
  ): Promise<Record<string, string | null>> => {
    const sec = BUSINESS_PROFILE_SPEC.find((s) => s.key === sectionKey);
    if (!sec) return {};
    const keys: string[] = [];
    const keyLines: string[] = [];
    const labelByKey: Record<string, string> = {};
    for (const fw of sec.frameworks) {
      for (const q of fw.questions) {
        const k = businessProfileAnswerKey(sec.key, fw.key, q.key);
        keys.push(k);
        keyLines.push(`- "${k}": ${q.label}`);
        labelByKey[k] = q.label;
      }
    }
    const hasMaterial =
      Boolean((source.textCorpus ?? '').trim()) || (source.inlineFiles?.length ?? 0) > 0;
    const hint = source.companyHint?.trim();

    const taskLine = hasMaterial
      ? `TASK: Fill in ONLY this section of a Business Profile from the attached files and plain-text excerpts in this request.`
      : hint
        ? `TASK: Fill in ONLY this section of a Business Profile using reliable general knowledge about: "${hint}". No document was attached.`
        : `TASK: Fill in ONLY this section of a Business Profile. The user provided no documents and no company or website—do not invent a specific company, brand, URL, or numeric claims; use null where facts would be fabricated.`;

    const hintLine =
      hasMaterial && hint
        ? `\nThe user also provided this company identifier: "${hint}". Use it only to disambiguate which entity the materials refer to—not to invent answers for topics the materials do not cover.`
        : '';

    const sourcingRulesNoSource = `RULES:
- No documents or company identifier were provided. Do not invent company names, URLs, customers, revenue, headcount, or other entity-specific facts.
- Use JSON null wherever a truthful, specific answer would require such facts.
- You may supply brief, industry-agnostic entrepreneurship guidance only when a question can be answered without naming or implying a particular business.
- Keep each non-null value concise (1–4 short paragraphs max per field unless the question clearly needs a list).
- Do not use placeholder strings; use JSON null instead.
- Output only the JSON object.`;

    const sourcingRules = hasMaterial
      ? `RULES:
- **Grounding:** Every non-null value must be clearly supported by the provided files or plain-text excerpts (explicit text or a direct, verifiable inference from that text).
- Prefer JSON null over guessing. If the materials do not address a question, use null for that key.
- Do not fill gaps from unrelated public facts, “typical startup” boilerplate, or general web memory.
- Keep each value concise but informative (1–4 short paragraphs max per field unless the question clearly needs a list).
- Do not use placeholder strings (e.g. "N/A", "not specified", "TBD"); use JSON null instead.
- Output only the JSON object.`
      : hint
        ? `RULES:
- Use reliable general knowledge about the company only where you have **very high** confidence for a **specific** fact.
- If you cannot answer without speculation, use JSON null for that key.
- Do not infer numbers, named customers, URLs, or headcount that are not well-attested in public knowledge about that entity.
- Keep each value concise but informative (1–4 short paragraphs max per field unless the question clearly needs a list).
- Do not use placeholder strings; use JSON null instead.
- Output only the JSON object.`
        : sourcingRulesNoSource;

    const currentValuesBlock = formatBusinessProfileCurrentValuesBlock(keys, labelByKey, source.existingAnswers);
    const mergeBlock = hasMaterial
      ? mergeCertaintyBlockDocumentBacked()
      : mergeCertaintyBlockNoDocument(Boolean(hint));

    const prompt = `You are an expert at disciplined entrepreneurship and startup documentation.

${taskLine}${hintLine}

SECTION TITLE: ${sec.title}

OUTPUT: A single JSON object only. No markdown code fences, no explanation. Use exactly these keys (use null for any missing value):
${keys.join(', ')}

Each key corresponds to one guided question:
${keyLines.join('\n')}${currentValuesBlock}

${sourcingRules}

${mergeBlock}`;

    const rawResult = await runBusinessProfileGeneration(prompt, source);
    return normalizeBusinessProfileResult(rawResult, keys);
  },

  /**
   * Generate structured business profile fields from a document (parallel section calls).
   * When plain-text excerpts exist, a short routing pass selects which section tabs to run; PDF-only
   * uploads run all six sections against the files. Returns answerKey -> string|null.
   */
  generateBusinessProfileFromDocument: async (
    documentInput: string,
    options: {
      mimeType?: string;
      companyHint?: string;
      extraInlineFiles?: { data: string; mimeType: string; name?: string }[];
      existingAnswers?: Record<string, string>;
    } = {}
  ): Promise<Record<string, string | null>> => {
    const inlineFiles: { data: string; mimeType: string; name?: string }[] = [...(options.extraInlineFiles ?? [])];
    if (options.mimeType && documentInput) {
      inlineFiles.unshift({ data: documentInput, mimeType: options.mimeType, name: 'document' });
    }
    const textOnly = documentInput.trim() && !options.mimeType;
    const fullExisting = options.existingAnswers;

    const sectionSourceBase: BusinessProfileSectionSource = {
      companyHint: options.companyHint,
      textCorpus: textOnly ? documentInput : undefined,
      inlineFiles: inlineFiles.length > 0 ? inlineFiles : undefined,
    };

    const sectionKeysToRun = await geminiService.routeBusinessProfileSectionKeys(sectionSourceBase);

    const parts = await Promise.all(
      sectionKeysToRun.map((sectionKey) => {
        const sec = BUSINESS_PROFILE_SPEC.find((s) => s.key === sectionKey);
        if (!sec) return Promise.resolve({} as Record<string, string | null>);
        const sectionKeys = getAnswerKeysForSection(sec.key);
        let existingAnswers: Record<string, string> | undefined;
        if (fullExisting) {
          const slice: Record<string, string> = {};
          for (const k of sectionKeys) {
            const v = fullExisting[k];
            if (typeof v === 'string' && v.trim()) slice[k] = v.trim();
          }
          if (Object.keys(slice).length > 0) existingAnswers = slice;
        }
        const sectionSource: BusinessProfileSectionSource = {
          ...sectionSourceBase,
          ...(existingAnswers ? { existingAnswers } : {}),
        };
        return geminiService.generateBusinessProfileSection(sectionKey, sectionSource);
      })
    );
    const result: Record<string, string | null> = {};
    for (const part of parts) {
      for (const [k, v] of Object.entries(part)) {
        if (v !== undefined) result[k] = v;
      }
    }
    return result;
  },

  /**
   * Map spoken or typed business description to sparse Business Profile answer keys
   * (one or more sections / "reports"). Keys use section.framework.question slugs.
   */
  draftBusinessProfileFromDescription: async (
    description: string,
    options?: { existingAnswers?: Record<string, string> }
  ): Promise<BusinessProfileVoiceDraft> => {
    const trimmed = (description || '').trim();
    if (!trimmed) {
      throw new Error('Describe your business (text or voice) before using Build it for me.');
    }
    const catalog = buildBusinessProfileKeyCatalogForPrompt();
    const existingBlock = formatBusinessProfileExistingSummaryForVoice(options?.existingAnswers);
    const prompt = `You are an expert at disciplined entrepreneurship and startup documentation.

The user is filling a structured **Business Profile** with six thematic sections (tabs). Each field has a stable JSON key in the form section.framework.question.

## User description (voice or typed)
${truncate(trimmed, 14000)}
${existingBlock ? `\n${existingBlock}\n` : ''}
## Allowed fields (only these keys may appear in "filled")
${catalog}

## Task
1. Read the description. Map **only explicit facts** (or what the user clearly entails in plain language) to the **most relevant** field keys.
2. You may populate **multiple sections** in one response only when the description **explicitly** supports each key you output.
3. **Sparse "filled":** Include a key only when the description **explicitly** states or clearly entails that fact for that field. Omit keys you cannot support (do not output null entries).
4. **No speculative inference:** If the user is vague, map **only** what is explicit; put uncertainty or caveats in "notes"—do **not** invent ICP, pricing, beachhead, or personas they did not say.
5. **Merged values:** When CURRENT PROFILE shows prior text for a key, put that key in "filled" only if the description **adds or changes** something with explicit support. The value must be the **full** merged field text (keep prior content that still applies and integrate new explicit facts). If the description does not address a key, **omit** it from "filled" so the prior answer remains.
6. **Ambiguity vs CURRENT:** If the description could conflict with CURRENT PROFILE but is ambiguous, **omit** that key from "filled" so CURRENT wins.
7. Do **not** invent unrelated content to fill fields.
8. Keep each "filled" value concise (typically 1–4 short paragraphs unless a list is clearly needed).

## Output
Return ONE JSON object only (no markdown fences):
{
  "routing_rationale": string (one or two sentences, user-facing — what you mapped and where),
  "filled": { "<section.framework.question>": "<text>", ... },
  "notes": string[] (optional — uncertainty or caveats)
}

If nothing in the description maps to any field, return "filled": {} and explain in routing_rationale.`;

    const parsed = await geminiService.generateBasic(prompt, true, 'business_profile');
    return sanitizeBusinessProfileVoiceDraft(parsed);
  },

  /** Chat with retry on 503/502/504 for persona conversation resilience. */
  chat: async (systemPrompt: string, history: { role: 'user' | 'model', text: string }[], newMessage: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...history.map(h => ({
            role: h.role,
            parts: [{ text: truncate(h.text, 20000) }]
          })),
          { role: 'user', parts: [{ text: truncate(newMessage, 20000) }] }
        ],
        config: {
          systemInstruction: truncate(systemPrompt, MAX_SYSTEM_CHARS),
        },
      });
      recordGeminiResponseUsage(response, 'run_simulation');

      return response.text || "";
    } catch (error: any) {
      console.error('Gemini API error:', error);
      
      // Check if it's a quota/rate limit error
      if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('free_tier')) {
          throw new Error(`Free Tier Quota Exceeded: Daily limit of 20 requests reached.\n\nOptions:\n1. Wait until quota resets\n2. Upgrade to paid API key\n\nCheck usage: https://aistudio.google.com/app/apikey`);
        }
        throw new Error(`Rate Limit Exceeded: ${errorMsg}`);
      }
      
      throwIfServiceUnavailable(error, 'Failed to generate chat response.');
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate chat response. Please check your API key and quota.'}`);
    }
    });
  },

  /**
   * Compute persuasion score (1-100) from a full conversation by sending it to the LLM.
   * Used after each persona response in persuasion simulations so the sidebar always shows a score.
   */
  computePersuasionScore: async (fullConversation: string): Promise<number> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are evaluating a persuasion conversation. The "persona" (the agent being persuaded) has been in a back-and-forth dialogue. Based on the conversation below, how persuaded is the persona on a scale of 1 to 100? Consider their stated position, willingness to agree, and any commitments or openness expressed.

Conversation:
${truncate(fullConversation, 50000)}

Respond with exactly one line in this format: Persuasion: N%
where N is an integer from 1 to 100. No other text.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    recordGeminiResponseUsage(response, 'run_simulation');
    const text = (response.text || '').trim();
    const parsed = parseLastPersuasionPercentFromText(text);
    if (parsed != null) return parsed;
    return 50; // fallback if parsing fails
  },

  /**
   * Turn a natural-language description into a complete simulation template draft (JSON),
   * then sanitize so the Build form is always valid. Uses the same API key as generateBasic.
   */
  draftSimulationFromDescription: async (description: string): Promise<SimulationDraft> => {
    const trimmed = (description || "").trim();
    if (!trimmed) {
      throw new Error("Describe what you want to simulate (text or voice) before building.");
    }
    const prompt = `You are an expert simulation designer for a product that builds "simulation templates" for AI personas.

## User description (primary source of truth)
${truncate(trimmed, 12000)}

## Your task
Return ONE JSON object only (no markdown fences, no preamble). Every top-level key below MUST be present and non-empty where applicable. If the user omits details, invent sensible, specific defaults that match the scenario—never leave strings blank or arrays empty where the schema requires content.

## JSON shape (exact keys)
{
  "title": string,
  "description": string,
  "simulation_type": one of: "report" | "persuasion_simulation" | "response_simulation" | "survey" | "persona_conversation" | "idea_generation",
  "allowed_persona_types": array of one or both of: "synthetic_user", "advisor",
  "persona_count_min": integer 1-5,
  "persona_count_max": integer 1-5, must be >= persona_count_min,
  "type_specific_config": object — keys depend on simulation_type (see below),
  "required_input_fields": array of at least one object: { "name": string (snakeCase or camelCase), "type": string, "required": boolean, "options"?: string[] },
  "visibility": "private" or "public",
  "icon": optional string — Lucide-style icon name matching the simulation type when possible: FileText, MessageSquare, Target, BarChart3, Users, Lightbulb
}

## Runner input field types (required_input_fields[].type)
One of: "text" | "image" | "table" | "pdf" | "multiple_choice" | "business_profile" | "survey_questions"
- For "multiple_choice", include "options" with at least two non-empty strings.
- For "business_profile", set name to "businessProfile".

## type_specific_config by simulation_type

**report**
- "report_structure": string (section headings, newline-separated)
- optional "report_example_file_name", "report_example_content_base64" only if the user explicitly provided a file; otherwise omit both

**persuasion_simulation**
- "context_label": string (short label for optional user context, can be empty string "")
- "decision_point": string (what the user is trying to persuade the persona of)
- "decision_criteria": string (how to interpret the final Persuasion: N% line)

**response_simulation**
- "decision_type": "numeric" | "action" | "text"
- If numeric: "unit" string (required), e.g. "minutes", "%", "dollars"
- If action: "action_options" string, comma-separated possible actions
- If text: no extra keys required beyond decision_type

**survey**
- "survey_mode": "generated" | "custom"
- If "generated": include "survey_purpose" string and "survey_questions" array of { "type": "text"|"numeric"|"multiple_choice", "question": string, "options"?: string[] } with at least one question; for multiple_choice include options
- If "custom": only survey_mode is needed (runner will supply survey_questions field)

**persona_conversation**
- "max_persona_turns": one of 5,8,10,12,15,20,25,30,40,50

**idea_generation**
- "num_ideas": one of 3,4,5,6,7,8,9,10,12,15,20

## Rules
- Choose simulation_type that best fits the user description.
- For persona_conversation, use persona_count_min at least 2 and persona_count_max at least 2.
- description should be a rich internal spec (purpose, tone, audience, success criteria)—not a single vague sentence unless the user only gave one sentence.
- required_input_fields must reflect what the runner would realistically provide (e.g. bgInfo text for context, stimulus image for creative review, businessProfile if company context needed).

Output valid JSON only.`;

    const parsed = await geminiService.generateBasic(prompt, true, 'build_simulation');
    return sanitizeDraft(parsed);
  },

  /**
   * Plan persona build: synthetic user vs advisor, sub-method, and field values
   * to match the Build Persona UI (same flows as manual selection).
   */
  draftPersonaBuildFromDescription: async (
    description: string,
    opts?: { forcePersonaType?: "synthetic_user" | "advisor" }
  ): Promise<PersonaBuildDraft> => {
    const trimmed = (description || "").trim();
    if (!trimmed) {
      throw new Error("Describe who you want to build (text or voice) before using Build it for me.");
    }
    const lock =
      opts?.forcePersonaType === "advisor"
        ? "The user is already on the Advisor builder. You MUST set persona_type to \"advisor\" only."
        : opts?.forcePersonaType === "synthetic_user"
          ? "The user is already on the Synthetic User builder. You MUST set persona_type to \"synthetic_user\" only."
          : "Choose persona_type \"synthetic_user\" or \"advisor\" from the description.";

    const prompt = `You route and pre-fill a "Build Persona" product wizard.

## User description (voice or typed)
${truncate(trimmed, 14000)}

## Constraint
${lock}

## Synthetic users (persona_type = "synthetic_user")
Pick exactly one synthetic_method:
- "problem_solution" — user has problem/solution style inputs. Fill problem, solution, differentiation, alternatives (substantive paragraphs when possible). Set context "B2B" or "B2C". Set persona_count 1-5.
- "supporting_docs" — user references an uploaded doc, deck, research, or long pasted business material in speech; put that narrative into supporting_docs_content as plain text (synthesize from description if they summarized a doc verbally).
- "business_profile" — user wants personas from their company context / ICP / "our customers" without full problem-solution text. Fill specific_user_type when they name a segment. persona_count 1-5.

## Advisors (persona_type = "advisor")
Pick advisor_source:
- "linkedin" — they mention LinkedIn, resume, CV paste, profile scrape, job history.
- "free_text" — rough expert notes, bullets, or "make an advisor who knows X" without a full LinkedIn paste.
- "pdf" ONLY if they explicitly say they will upload or have a PDF/book file; otherwise prefer free_text or linkedin and put prose in advisor_source_text.

advisor_source_text: the main paste area content (LinkedIn-style block OR expert notes). Never leave empty for linkedin/free_text—derive from description.

## Output
Return ONE JSON object only (no markdown fences):
{
  "persona_type": "synthetic_user" | "advisor",
  "routing_rationale": string (one or two sentences, user-facing),
  "synthetic_method": "problem_solution" | "supporting_docs" | "business_profile" | null,
  "problem": string | "",
  "solution": string | "",
  "differentiation": string | "",
  "alternatives": string | "",
  "context": "B2B" | "B2C" | null,
  "persona_count": number 1-5,
  "supporting_docs_content": string | "",
  "specific_user_type": string | "",
  "advisor_source": "linkedin" | "pdf" | "free_text" | null,
  "advisor_source_text": string | ""
}

Omit keys not needed for the chosen persona_type (use "" for unused strings). persona_count always set.`;

    const parsed = await geminiService.generateBasic(prompt, true, 'build_personas');
    return sanitizePersonaBuildDraft(parsed, { forcePersonaType: opts?.forcePersonaType });
  },

  /**
   * Map a natural-language run intent to a template id, persona ids, and runner text fields.
   */
  draftSimulationRunFromDescription: async (
    description: string,
    ctx: SimulationRunDraftContext
  ): Promise<SimulationRunDraft> => {
    const trimmed = (description || "").trim();
    if (!trimmed) {
      throw new Error("Describe what you want to run (text or voice) before using Build it for me.");
    }
    if (!ctx.templates.length) {
      throw new Error("No simulations are available to run yet.");
    }

    const templatePayload = ctx.templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: truncate(t.description || "", 800),
      simulation_type: t.simulation_type || "report",
      persona_count_min: t.persona_count_min ?? 1,
      persona_count_max: t.persona_count_max ?? 1,
      allowed_persona_types: t.allowed_persona_types || [],
      required_input_fields: (t.required_input_fields || []).map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        options: f.options,
      })),
    }));

    const personaPayload = ctx.personas.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type || "",
      description: truncate(p.description || "", 400),
    }));

    const prompt = `You help a user configure a **simulation run** (not create a template). Pick one template and personas from the lists only. Pre-fill text runner fields from the user's description.

## User description
${truncate(trimmed, 12000)}

## Accessible simulation templates (JSON)
${JSON.stringify(templatePayload)}

## Personas the user can select (JSON)
${JSON.stringify(personaPayload)}

## Saved business profile
${ctx.hasSavedBusinessProfile ? "The user has a saved business profile—business_profile-type inputs are satisfied at runtime." : "The user has NO saved business profile—do not rely on business_profile fields being auto-filled."}

## Rules
- template_id MUST be exactly one of the template ids from the list, or null if truly impossible—prefer the best match.
- Optionally set template_title_hint if the user named a simulation loosely (helps recovery); short string.
- persona_ids: only ids from the persona list. Respect each template's persona_count_min and persona_count_max and allowed_persona_types.
- input_values: object mapping **required_input_fields[].name** to string content for types **text** (use long text in a single string), **multiple_choice** (value must exactly match one of options), or **textarea**-style prompts. Omit keys for: image, pdf, table, business_profile, survey_questions.
- If a common context field is named bgInfo or "Background" or similar in required_input_fields, fill it with scenario context from the user.
- routing_rationale: one or two sentences for the UI.

Return ONE JSON object only (no markdown fences):
{
  "template_id": string | null,
  "template_title_hint": string | "",
  "persona_ids": string[],
  "input_values": { },
  "routing_rationale": string
}`;

    const parsed = await geminiService.generateBasic(prompt, true, 'run_simulation');
    return sanitizeSimulationRunDraft(parsed, ctx);
  },

  /**
   * Refine the main "describe your persona" notes via a short chat turn (assistant reply + merged notes).
   */
  refinePersonaBuildNotesViaChat: async (
    currentNotes: string,
    history: { role: "user" | "assistant"; text: string }[],
    userMessage: string
  ): Promise<{ assistant_reply: string; updated_notes: string }> => {
    const hist = history
      .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`)
      .join("\n");
    const prompt = `You help refine notes for a persona-building wizard.

Current notes:
${truncate(currentNotes, 24000)}

Chat so far:
${truncate(hist, 12000)}

New user message:
${truncate(userMessage, 6000)}

Return ONE JSON object only, no markdown fences:
{
  "assistant_reply": string (brief, helpful),
  "updated_notes": string (full updated notes: merge the user's request; preserve facts unless they asked to remove; keep third person; ready to re-send to "Build it for me")
}`;

    const parsed = await geminiService.generateBasic(prompt, true, 'build_personas');
    const ar =
      typeof (parsed as { assistant_reply?: unknown })?.assistant_reply === "string"
        ? String((parsed as { assistant_reply: string }).assistant_reply).trim()
        : "";
    const un =
      typeof (parsed as { updated_notes?: unknown })?.updated_notes === "string"
        ? String((parsed as { updated_notes: string }).updated_notes).trim()
        : "";
    return { assistant_reply: ar || "Updated your notes.", updated_notes: un || currentNotes };
  },

  /**
   * Generate a system prompt for a simulation from its full configuration.
   * Extracts intent, goals, and instructions from the user's description and
   * type-specific fields, then synthesizes a high-quality prompt while
   * preserving the required structured output format for the simulation type.
   */
  generateSystemPromptFromConfig: async (config: CreateSimulationRequest): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Set VITE_GEMINI_API_KEY to generate the system prompt with AI.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const simType = config.simulation_type || 'report';
    const typeOutputSpec = SIMULATION_TYPE_OUTPUT_SPECS[simType];
    const typeSpecSection = typeOutputSpec
      ? `\n## MANDATORY OUTPUT FORMAT (do not change)\nThe simulation must produce exactly this kind of output. Your system prompt must enforce it:\n\n${typeOutputSpec}\n`
      : '';

    const typeConfig = config.type_specific_config || {};
    const isGeneratedSurvey =
      simType === 'survey' &&
      (typeConfig.survey_mode as string) === 'generated';
    const surveyQuestions = (typeConfig.survey_questions as Array<{ type: string; question: string; options?: string[] }>) || [];
    const hasSurveyQuestions = isGeneratedSurvey && surveyQuestions.length > 0;

    let surveyQuestionsSection = '';
    if (hasSurveyQuestions) {
      const lines: string[] = [
        '',
        '## MANDATORY: Survey questions in system prompt',
        'The generated system prompt MUST include the following survey questions section verbatim (exactly these questions in this order). Do not summarize or rephrase the questions—copy them into your system prompt output:',
        '',
        '### Survey questions (in order)',
      ];
      surveyQuestions.forEach((q, i) => {
        lines.push(`${i + 1}. [${q.type}] ${q.question}`);
        if (q.type === 'multiple_choice' && q.options?.length) {
          lines.push('   Options: ' + q.options.filter(Boolean).join(', '));
        }
      });
      lines.push('');
      surveyQuestionsSection = lines.join('\n');
    }

    // Omit icon so it is not passed to chat / included in the system prompt
    const { icon: _icon, ...configForPrompt } = config;

    const prompt = `You are an expert at turning product and simulation configs into clear, high-quality system prompts for AI personas.

## Your task
1. **Extract** meaning from the user's inputs: read the title, description, and every type-specific field (decision_point, decision_criteria, report_structure, profile_structure, survey_purpose, survey_questions, etc.). Infer:
   - The **purpose** and **goal** of the simulation (what the user wants to achieve).
   - **Tone and style** (e.g. professional, conversational, formal, advisory).
   - **Key instructions** the persona must follow (what to emphasize, what to avoid, how to use context).
   - **Domain and audience** (who the persona is addressing, in what context).
   - **Success criteria** (what "good" looks like for this simulation).
2. **Synthesize** a single system prompt that:
   - Opens with a clear, concise "what this simulation is" section that reflects the extracted purpose and goal (do not just paste the description verbatim—rephrase and sharpen it).
   - Includes an "how to behave" / "instructions for the persona" section built from the extracted instructions, tone, and success criteria.
   - Documents the template variables below exactly (so they can be replaced at runtime).
   - Ends with the MANDATORY OUTPUT FORMAT section so the persona knows the exact structure of the response (conversation only, report, persuasion percentage, etc.).

## Rules
- **Inputs vs persona (critical):** All template variables that are filled at runtime with user-provided content—{{BACKGROUND_INFO}}, {{OPENING_LINE}}, {{BUSINESSPROFILE}}, and every required_input_fields placeholder—are input from the **person running the simulation** (the user/client). For example: their business background, context, opening line, or other required fields. The **persona** is the synthetic character defined only by {{SELECTED_PROFILE}} and {{SELECTED_PROFILE_FULL}}. The persona uses the user's inputs to advise or respond; those inputs are not the persona's own background. The generated system prompt MUST state this distinction clearly so the AI never treats business background or other user inputs as if they were the persona's.
- **Do not** copy the description or config fields word-for-word. Interpret and extract; turn them into precise, actionable instructions.
- **The AI must respond ONLY as the persona**—never describe, reference, or embed the persona in the response (no "As the synthetic user...", "The persona would say...", or meta-commentary). The system prompt must state clearly that the AI answers AS IF they were the persona, in first person only.
- **Focus vs persona:** The **focus** of the simulation is always the **user's inputs** (whatever replaces the template variables: {{BACKGROUND_INFO}}, {{OPENING_LINE}}, {{BUSINESSPROFILE}}, or other required_input_fields). The **persona** is in the background: they use their profile ({{SELECTED_PROFILE_FULL}}) to inform perspective and assist in decision-making, but the analysis, report, or conversation must be centered on the **user's situation and inputs**, not the persona's own organization or story. The system prompt must state this clearly.
- **Do** document every required_input_fields entry as a template variable: {{FIELD_NAME}} (UPPERCASE), with type and name. These will be replaced at runtime.
- **Do** include the core variables: {{SELECTED_PROFILE}}, {{SELECTED_PROFILE_FULL}}, {{BACKGROUND_INFO}}. Use required_input_fields placeholders (e.g. {{FIELD_NAME}}) for user-provided content; do not require {{OPENING_LINE}}.
- **If the config includes a business_profile (or businessProfile) input field:** The system prompt MUST explicitly state that {{BUSINESSPROFILE}} is the **client's/user's business**—the company the persona is advising or analyzing—and that the persona must base their analysis (e.g. SWOT, report, recommendations) on that business only, not on their own organization.
- **Do** keep the same strict output behavior for this simulation type (see MANDATORY OUTPUT FORMAT). The persona's response format must match it exactly.
- **Plain text only (every simulation type):** The system prompt MUST state that the persona must never deliver the simulation result as JSON, YAML, or XML, and must not wrap answers in \`\`\`json (or any fenced) blocks. All visible output is human-readable prose or the exact line format the type requires (e.g. persuasion score line)—never machine-readable structured payloads.
- **For survey simulations with survey_mode "generated":** The system prompt MUST include a "Survey questions (in order)" section listing every question from type_specific_config.survey_questions verbatim, in order, with type and (for multiple_choice) options. Do not summarize or omit any question.
- **If the config includes a survey_questions input field:** This means the person running the simulation will define their own survey questions at runtime. The system prompt MUST document the {{FIELD_NAME}} placeholder for that field and explain that it will contain the survey questions created by the runner (each question with its type and, for multiple choice, its options). The persona must use those runner-provided questions as the survey to answer, treating them the same way as admin-defined generated survey questions.
- Output ONLY the system prompt text. No preamble, no "Here is the prompt", no explanation.
${typeSpecSection}
${surveyQuestionsSection}

## Configuration from the user (extract from this)
\`\`\`json
${JSON.stringify(configForPrompt, null, 2)}
\`\`\`

Output only the system prompt text, nothing else.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: truncate(prompt, MAX_PART_CHARS),
    });
    recordGeminiResponseUsage(response, 'build_simulation');
    const text = (response.text || '').trim();
    if (!text) throw new Error('AI did not return a system prompt.');
    return text;
  },

  /**
   * Persona v Persona: Moderator decides who speaks first.
   * Returns the persona_id (UUID string) of the chosen speaker.
   * Uses retry on 503/502/504 for resilience.
   */
  moderatorWhoSpeaksFirst: async (
    openingLine: string,
    personas: { id: string; name: string }[]
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const list = personas.map((p) => `${p.name} (id: ${p.id})`).join('\n');
    const prompt = `You are a moderator for a structured conversation between multiple personas. The topic or opening line for the conversation is:

"${truncate(openingLine, 2000)}"

The following personas are available to speak. Choose exactly ONE persona to speak first. Consider who would naturally start this kind of discussion.

Personas:
${list}

Respond with a single JSON object only, no other text. Use this exact format:
{"persona_id": "<paste the id of the chosen persona>"}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    recordGeminiResponseUsage(response, 'run_simulation');
    const text = response.text || '';
    const parsed = extractJson(text);
    const id = parsed?.persona_id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Moderator did not return a valid persona_id. Please try again.');
    }
    return id.trim();
    });
  },

  /**
   * Persona v Persona: Moderator decides next speaker or end.
   * Returns { action: 'NEXT', persona_id } or { action: 'END' }.
   * Uses retry on 503/502/504 for resilience.
   */
  moderatorNextOrEnd: async (
    openingLine: string,
    personas: { id: string; name: string }[],
    conversation: { speakerName: string; content: string }[],
    personaTurnCount: number,
    maxTurns: number
  ): Promise<{ action: 'NEXT' | 'END'; persona_id?: string }> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const list = personas.map((p) => `${p.name} (id: ${p.id})`).join('\n');
    const convoText = conversation
      .map((m) => `${m.speakerName}: ${m.content}`)
      .join('\n\n');
    const mustEndHint =
      personaTurnCount >= maxTurns
        ? `\n\nIMPORTANT: The conversation has reached the maximum of ${maxTurns} persona turns. You MUST respond with {"action": "END"} and no further turns.`
        : '';
    const prompt = `You are a moderator for a structured conversation between multiple personas.

Opening line / topic:
"${truncate(openingLine, 2000)}"

Personas (id required in your response when choosing NEXT):
${list}

Conversation so far:
${truncate(convoText, 15000)}
${mustEndHint}

Decide either:
1. Continue: another persona should respond. Reply with JSON: {"action": "NEXT", "persona_id": "<id of the persona who should speak next>"}
2. End: the conversation is complete. Reply with JSON: {"action": "END"}

Respond with a single JSON object only. Do not choose the same persona who just spoke unless others have spoken in between.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    recordGeminiResponseUsage(response, 'run_simulation');
    const text = response.text || '';
    const parsed = extractJson(text);
    const action = parsed?.action === 'END' ? 'END' : 'NEXT';
    if (action === 'END') {
      return { action: 'END' };
    }
    const persona_id = typeof parsed?.persona_id === 'string' ? parsed.persona_id.trim() : undefined;
    if (!persona_id) {
      throw new Error('Moderator did not return a valid persona_id for NEXT. Please try again.');
    }
    return { action: 'NEXT', persona_id };
    });
  },

  /**
   * Persona v Persona: Moderator summarizes the conversation and answers the opening line.
   * Uses retry on 503/502/504 for resilience.
   */
  moderatorSummarize: async (
    openingLine: string,
    conversation: { speakerName: string; content: string }[]
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const convoText = conversation
      .map((m) => `${m.speakerName}: ${m.content}`)
      .join('\n\n');
    const prompt = `You are a moderator summarizing a conversation between personas.

Opening line / topic that the conversation addressed:
"${truncate(openingLine, 2000)}"

Full conversation:
${truncate(convoText, 30000)}

Provide:
1. A concise summary of the conversation (key points, agreements or disagreements, outcomes).
2. A direct answer or conclusion that addresses the opening line.

Write in clear paragraphs. No JSON. Output only the summary and answer.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    recordGeminiResponseUsage(response, 'run_simulation');
    return (response.text || '').trim() || 'No summary generated.';
    });
  },

  /**
   * One-shot executive summary for a completed survey run (not part of the persona agent turn).
   */
  summarizeSurveyRun: async (qaPlainTextBundle: string, simulationTitle?: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey });
      const title = (simulationTitle || 'Survey').trim();
      const prompt = `You are summarizing completed survey responses for an analyst.

Simulation: "${truncate(title, 200)}"

Below is plain-text survey output (Question / Answer blocks only). Write ONE cohesive executive summary: 2–4 short paragraphs covering overall stance, key themes, notable patterns, and any tensions or surprises. Do not repeat each question. Do not use bullet lists unless essential. No JSON. No "Question:" or "Answer:" labels in your output—prose only.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${prompt}\n\n---\n\n${truncate(qaPlainTextBundle, 48000)}`,
      });
      recordGeminiResponseUsage(response, 'run_simulation');
      return (response.text || '').trim() || 'No summary generated.';
    });
  },
};

