import { GoogleGenAI } from "@google/genai";
import type { CreateSimulationRequest } from "./simulationTemplateApi.js";

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
  'text/plain',
  'text/csv',
  'application/json',
] as const;

/** Accept attribute value for file inputs that should accept any file type Gemini supports. */
export const GEMINI_FILE_INPUT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.csv,.json,application/pdf,image/png,image/jpeg,image/webp,image/gif,image/heic,text/plain,text/csv,application/json';

/** Per-type description of expected output and behavior; passed when generating the system prompt. */
export const SIMULATION_TYPE_OUTPUT_SPECS: Record<string, string> = {
  report: 'Strict output: A single downloadable report from the {{SELECTED_PROFILE_FULL}} perspective. Exactly one paragraph of reasoning (or summary), then the full report in a structured/column format. No chat. No follow-up. Read-only output only.',
  persuasion_simulation: 'Strict output: Back-and-forth chat. At the end, the persona must state clearly a single persuasion percentage (e.g. \'Persuasion: 75%\') indicating how persuaded the agent is. The UI will parse this to display the result. No other structured output—conversation plus this final percentage.',
  response_simulation: 'Strict output: Exactly one response. Must include: (1) the confidence level (e.g. percentage or score), (2) the single output—for numeric type always give a number AND its unit (e.g. "45 minutes", "$1,200", "75%"); for action/text give the chosen action or text answer—and (3) at most one paragraph of reasoning. No chat. No further interaction.',
  survey: 'Strict output: Survey results only. Persona answers the survey in the given context; prebuilt or generated surveys are allowed. Output is survey responses (suitable for CSV export) and optionally a short summary/bullets. No chat. No follow-up conversation.',
  persona_conversation: 'Moderated multi-persona conversation. Multiple personas discuss an opening line in turns; an LLM moderator decides who speaks next and when the conversation ends. Each persona responds in a separate call with full conversation context. After the conversation (or after max 20 persona turns), the moderator summarizes and answers the opening line.',
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

export const geminiService = {
  generateBasic: async (prompt: string, isJson: boolean = false): Promise<any> => {
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
      
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate content. Please check your API key and quota.'}`);
    }
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
      
      throw new Error(`Gemini API error: ${error?.message || 'Failed to extract facts. Please check your API key and quota.'}`);
    }
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

  generateChain: async (templateContent: string, inputs: Record<string, string>, useExtendedThinking: boolean = false): Promise<string> => {
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
      });

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
      
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate chain. Please check your API key and quota.'}`);
    }
  },

  /**
   * Run a specialized simulation with optional multi-modal input
   */
  runSimulation: async (prompt: string, imageData?: string, mimeType?: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: prompt }];

    if (imageData && mimeType) {
      // imageData should already be pure base64 (without data URL prefix)
      // But handle both cases: if it has a comma (data URL), extract base64; otherwise use as-is
      let base64Data: string;
      if (imageData.includes(',')) {
        base64Data = imageData.split(',')[1];
      } else {
        base64Data = imageData;
      }
      
      // Validate base64 data is not empty
      if (!base64Data || base64Data.trim().length === 0) {
        throw new Error('Invalid file data: base64 content is empty. Please ensure the file is valid and not corrupted.');
      }
      
      // Validate base64 format (basic check)
      if (!/^[A-Za-z0-9+/=]+$/.test(base64Data.replace(/\s/g, ''))) {
        throw new Error('Invalid file data: base64 format appears to be invalid. Please try uploading the file again.');
      }
      
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
      });

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
      
      throw new Error(`Gemini API error: ${error?.message || 'Failed to run simulation. Please check your API key and quota.'}`);
    }
  },

  /**
   * Generate a business profile from an uploaded document (e.g. business plan, 10-K) and optional company hint.
   * Uses document content and, if provided, the model's knowledge of the company for public information.
   * Returns a partial BusinessProfile object with snake_case keys.
   */
  generateBusinessProfileFromDocument: async (
    documentInput: string,
    options: { mimeType?: string; companyHint?: string } = {}
  ): Promise<Record<string, string | null>> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    const { mimeType, companyHint } = options;
    const hasFile = Boolean(mimeType && documentInput);
    const hintSection = companyHint?.trim()
      ? `\nThe user also provided this company identifier for context: "${companyHint.trim()}". Use your knowledge of this company's public information (website, filings, news) to enrich and validate the profile where the document does not specify something.`
      : '';

    const prompt = `You are an expert at extracting structured business information from documents and public knowledge.

TASK: Fill in a complete business profile from the provided document${companyHint?.trim() ? ' and from your knowledge of the company' : ''}.${hintSection}

OUTPUT FORMAT: Respond with a single JSON object only. No markdown, no code fence, no explanation. Use exactly these keys (use null for any missing value):
business_name, mission_statement, vision_statement, description_main_offerings, key_features_or_benefits, unique_selling_proposition, pricing_model, customer_segments, geographic_focus, industry_served, what_differentiates, market_niche, revenue_streams, distribution_channels, key_personnel, major_achievements, revenue, key_performance_indicators, funding_rounds, website

RULES:
- Extract and infer from the document; for public companies you may use known facts (10-K, website, news) to fill gaps.
- Keep each value concise but informative (short paragraphs or bullet points where appropriate).
- If a field cannot be determined, use null for that key.
- Output only the JSON object.`;

    let rawResult: string | object;
    if (hasFile) {
      let base64Data: string = documentInput;
      if (documentInput.includes(',')) base64Data = documentInput.split(',')[1];
      if (!base64Data?.trim()) throw new Error('Invalid file data.');
      rawResult = await geminiService.runSimulation(prompt, base64Data, mimeType!);
    } else {
      const fullPrompt = `${prompt}\n\nDOCUMENT CONTENT:\n${truncate(documentInput, 100000)}`;
      rawResult = await geminiService.generateBasic(fullPrompt, true);
    }

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

    const keys = ['business_name','mission_statement','vision_statement','description_main_offerings','key_features_or_benefits','unique_selling_proposition','pricing_model','customer_segments','geographic_focus','industry_served','what_differentiates','market_niche','revenue_streams','distribution_channels','key_personnel','major_achievements','revenue','key_performance_indicators','funding_rounds','website'];
    const result: Record<string, string | null> = {};
    for (const k of keys) {
      const v = parsed[k];
      result[k] = v === undefined || v === null ? null : String(v).trim() || null;
    }
    return result;
  },

  chat: async (systemPrompt: string, history: { role: 'user' | 'model', text: string }[], newMessage: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
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
      
      throw new Error(`Gemini API error: ${error?.message || 'Failed to generate chat response. Please check your API key and quota.'}`);
    }
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

    // Omit icon so it is not passed to chat / included in the system prompt
    const { icon: _icon, ...configForPrompt } = config;

    const prompt = `You are an expert at turning product and simulation configs into clear, high-quality system prompts for AI personas.

## Your task
1. **Extract** meaning from the user's inputs: read the title, description, and every type-specific field (decision_point, decision_criteria, report_structure, profile_structure, survey_purpose, etc.). Infer:
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
- **Do not** copy the description or config fields word-for-word. Interpret and extract; turn them into precise, actionable instructions.
- **Do** document every required_input_fields entry as a template variable: {{FIELD_NAME}} (UPPERCASE), with type and name. These will be replaced at runtime.
- **Do** include the core variables: {{SELECTED_PROFILE}}, {{SELECTED_PROFILE_FULL}}, {{BACKGROUND_INFO}}. Use required_input_fields placeholders (e.g. {{FIELD_NAME}}) for user-provided content; do not require {{OPENING_LINE}}.
- **Do** keep the same strict output behavior for this simulation type (see MANDATORY OUTPUT FORMAT). The persona's response format must match it exactly.
- Output ONLY the system prompt text. No preamble, no "Here is the prompt", no explanation.
${typeSpecSection}

## Configuration from the user (extract from this)
\`\`\`json
${JSON.stringify(configForPrompt, null, 2)}
\`\`\`

Output only the system prompt text, nothing else.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: truncate(prompt, MAX_PART_CHARS),
    });
    const text = (response.text || '').trim();
    if (!text) throw new Error('AI did not return a system prompt.');
    return text;
  },

  /**
   * Persona v Persona: Moderator decides who speaks first.
   * Returns the persona_id (UUID string) of the chosen speaker.
   */
  moderatorWhoSpeaksFirst: async (
    openingLine: string,
    personas: { id: string; name: string }[]
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
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
    const text = response.text || '';
    const parsed = extractJson(text);
    const id = parsed?.persona_id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Moderator did not return a valid persona_id. Please try again.');
    }
    return id.trim();
  },

  /**
   * Persona v Persona: Moderator decides next speaker or end.
   * Returns { action: 'NEXT', persona_id } or { action: 'END' }.
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
  },

  /**
   * Persona v Persona: Moderator summarizes the conversation and answers the opening line.
   */
  moderatorSummarize: async (
    openingLine: string,
    conversation: { speakerName: string; content: string }[]
  ): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
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
    return (response.text || '').trim() || 'No summary generated.';
  },
};

