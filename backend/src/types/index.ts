export type PersonaType = 'synthetic_user' | 'advisor';

export type PersonaVisibility = 'private' | 'public' | 'global';

export interface User {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  is_admin?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Persona {
  id: string;
  user_id: string;
  name: string;
  type: PersonaType;
  description: string;
  avatar_url: string;
  visibility?: PersonaVisibility;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PersonaFile {
  id: string;
  persona_id: string;
  name: string;
  content: string;
  type: 'markdown' | 'pdf_analysis' | 'linked_in_profile';
  created_at: Date;
}

export interface ChatSession {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ChatSessionPersona {
  session_id: string;
  persona_id: string;
}

export interface Message {
  id: string;
  session_id: string;
  sender_type: 'user' | 'persona';
  persona_id?: string;
  content: string;
  created_at: Date;
}

/** Uploaded docs on Business Profile (Generate with AI); persisted for RAG / prompts. */
export interface BusinessProfileKnowledgeDocument {
  id: string;
  name: string;
  data: string;
  mimeType?: string;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  answers: Record<string, string>;
  knowledge_documents: BusinessProfileKnowledgeDocument[];
  /** Optional name or URL; used as context for AI profile generation. */
  company_hint: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrUpdateBusinessProfileRequest {
  answers?: Record<string, string>;
  knowledge_documents?: BusinessProfileKnowledgeDocument[];
  company_hint?: string | null;
}

export type SimulationMode = 
  | 'web_page' 
  | 'marketing' 
  | 'sales_pitch' 
  | 'investor_pitch';

export interface SimulationSession {
  id: string;
  user_id: string;
  persona_id: string;
  persona_ids?: string[];
  mode: SimulationMode;
  bg_info: string;
  opening_line?: string;
  stimulus_image?: string;
  mime_type?: string;
  name: string;
  system_prompt?: string | null;
  created_at: Date;
  updated_at: Date;
}

// Request/Response types
export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    is_admin?: boolean;
  };
}

export interface SimulationInputField {
  name: string;
  type: 'text' | 'image' | 'table' | 'pdf' | 'multiple_choice' | 'business_profile' | 'survey_questions';
  required: boolean;
  options?: string[];
}

export type SimulationType =
  | 'report'
  | 'persuasion_simulation'
  | 'response_simulation'
  | 'survey'
  | 'persona_conversation'
  | 'idea_generation';

/** Survey question shape for generated survey mode (type_specific_config.survey_questions). */
export interface SurveyQuestion {
  type: 'text' | 'numeric' | 'multiple_choice';
  question: string;
  options?: string[];
}

/**
 * type_specific_config (JSONB) can contain:
 * - persuasion_simulation: decision_point, decision_criteria (persuasion goal, how persuaded is measured)
 * - survey: survey_mode ('generated'|'custom'), survey_purpose, survey_questions (SurveyQuestion[] when generated)
 * - report: report_structure, etc.
 * - response_simulation: decision_type, question, possible_outputs, etc.
 * - idea_generation: num_ideas (number of ideas to output as a bullet list)
 */
export type SimulationVisibility = 'private' | 'public' | 'global';

export interface SimulationTemplate {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt: string;
  is_active: boolean;
  simulation_type?: SimulationType;
  allowed_persona_types?: PersonaType[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
  user_id?: string | null;
  visibility?: SimulationVisibility;
  creator_username?: string;
  is_starred?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSimulationRequest {
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt?: string;
  is_active?: boolean;
  simulation_type?: SimulationType;
  allowed_persona_types?: PersonaType[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
  /** User-created templates only; admin creates global on the server. */
  visibility?: SimulationVisibility;
}

export interface UpdateSimulationRequest {
  title?: string;
  description?: string;
  icon?: string;
  required_input_fields?: SimulationInputField[];
  system_prompt?: string;
  is_active?: boolean;
  simulation_type?: SimulationType;
  allowed_persona_types?: PersonaType[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
  visibility?: SimulationVisibility;
}

