export type PersonaType = 'synthetic_user' | 'advisor' | 'practice_person';

export interface Persona {
  id: string;
  user_id?: string;
  name: string;
  type: PersonaType;
  description: string;
  avatarUrl?: string;
  avatar_url?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  metadata: Record<string, any>;
  files?: PersonaFile[];
}

export interface PersonaFile {
  id: string;
  persona_id?: string;
  name: string;
  content: string;
  type: 'markdown' | 'pdf_analysis' | 'linked_in_profile';
  createdAt?: string;
  created_at?: string;
}

export interface Message {
  id: string;
  sessionId?: string;
  session_id?: string;
  senderType: 'user' | 'persona';
  sender_type?: 'user' | 'persona';
  personaId?: string;
  persona_id?: string;
  content: string;
  createdAt?: string;
  created_at?: string;
}

export interface ChatSession {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  personaIds?: string[];
  persona_ids?: string[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  is_admin?: boolean;
  isAdmin?: boolean;
}

export type SimulationMode = 
  | 'web_page' 
  | 'marketing' 
  | 'sales_pitch' 
  | 'investor_pitch';

export interface SimulationSession {
  id: string;
  userId?: string;
  user_id?: string;
  personaId: string;
  persona_id?: string;
  mode: SimulationMode;
  bgInfo?: string;
  bg_info?: string;
  openingLine?: string;
  opening_line?: string;
  stimulusImage?: string;
  stimulus_image?: string;
  mimeType?: string;
  mime_type?: string;
  name: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

