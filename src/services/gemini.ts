import { GoogleGenAI } from "@google/genai";

const MAX_PART_CHARS = 500000;
const MAX_SYSTEM_CHARS = 200000;

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
        throw new Error('Invalid file data: base64 content is empty. Please ensure the PDF file is valid and not corrupted.');
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
      
      // Check for specific PDF/document errors
      if (error?.status === 400 || error?.code === 400 || error?.message?.includes('400')) {
        const errorMsg = error?.message || JSON.stringify(error);
        if (errorMsg.includes('no pages') || errorMsg.includes('invalid') || errorMsg.includes('empty')) {
          throw new Error(`PDF Error: The document appears to be empty, corrupted, or invalid.\n\nPlease ensure:\n1. The PDF file is not corrupted\n2. The PDF contains at least one page\n3. The PDF is not password-protected\n4. The file size is reasonable (under 20MB)\n\nOriginal error: ${errorMsg}`);
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
  }
};

