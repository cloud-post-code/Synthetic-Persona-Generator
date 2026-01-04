export type PersonaType = 'synthetic_user' | 'advisor' | 'practice_person';

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

export type SimulationMode = 
  | 'web_page' 
  | 'marketing' 
  | 'sales_pitch' 
  | 'investor_pitch';

export interface SimulationSession {
  id: string;
  user_id: string;
  persona_id: string;
  mode: SimulationMode;
  bg_info: string;
  opening_line?: string;
  stimulus_image?: string;
  mime_type?: string;
  name: string;
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
  type: 'text' | 'textarea' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
}

export interface SimulationTemplate {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSimulationRequest {
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt: string;
  is_active?: boolean;
}

export interface UpdateSimulationRequest {
  title?: string;
  description?: string;
  icon?: string;
  required_input_fields?: SimulationInputField[];
  system_prompt?: string;
  is_active?: boolean;
}

