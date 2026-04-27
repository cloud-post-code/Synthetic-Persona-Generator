import { apiClient } from './api.js';

export type SimulationType =
  | 'report'
  | 'persuasion_simulation'
  | 'response_simulation'
  | 'survey'
  | 'persona_conversation'
  | 'idea_generation';

export type SimulationVisibility = 'private' | 'public' | 'global';

export interface SimulationInputField {
  name: string;
  type: 'text' | 'image' | 'table' | 'pdf' | 'multiple_choice' | 'business_profile' | 'survey_questions';
  required: boolean;
  /** For multiple_choice: list of option strings */
  options?: string[];
}

/** Survey question for Generated survey mode */
export interface SurveyQuestion {
  type: 'text' | 'numeric' | 'multiple_choice';
  question: string;
  options?: string[];
}

export interface SimulationTemplate {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt: string;
  is_active: boolean;
  simulation_type?: SimulationType;
  allowed_persona_types?: string[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
  user_id?: string | null;
  visibility?: SimulationVisibility;
  creator_username?: string;
  is_starred?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSimulationRequest {
  title: string;
  description?: string;
  icon?: string;
  required_input_fields: SimulationInputField[];
  system_prompt?: string;
  is_active?: boolean;
  simulation_type?: SimulationType;
  allowed_persona_types?: string[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
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
  allowed_persona_types?: string[];
  persona_count_min?: number;
  persona_count_max?: number;
  type_specific_config?: Record<string, unknown>;
  visibility?: SimulationVisibility;
}

export const simulationTemplateApi = {
  /** Templates the current user can run (own + public + global). Admin/global first. */
  getAll: async (): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>('/simulations/templates');
  },

  getMine: async (): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>('/simulations/templates/mine');
  },

  getLibrary: async (): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>('/simulations/templates/library');
  },

  getStarred: async (): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>('/simulations/templates/starred');
  },

  getByIdUser: async (id: string): Promise<SimulationTemplate> => {
    return apiClient.get<SimulationTemplate>(`/simulations/templates/${id}`);
  },

  createMine: async (data: CreateSimulationRequest): Promise<SimulationTemplate> => {
    return apiClient.post<SimulationTemplate>('/simulations/templates', data);
  },

  updateMine: async (id: string, data: UpdateSimulationRequest): Promise<SimulationTemplate> => {
    return apiClient.put<SimulationTemplate>(`/simulations/templates/${id}`, data);
  },

  deleteMine: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/simulations/templates/${id}`);
  },

  star: async (id: string): Promise<void> => {
    return apiClient.post<void>(`/simulations/templates/${id}/star`, {});
  },

  unstar: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/simulations/templates/${id}/star`);
  },

  /** Generate system prompt from config (deterministic server-side). */
  previewPrompt: async (data: CreateSimulationRequest): Promise<{ system_prompt: string }> => {
    return apiClient.post<{ system_prompt: string }>('/simulations/templates/preview-prompt', data);
  },

  // Admin endpoints
  getAllAdmin: async (includeInactive: boolean = false): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>(`/admin/simulations?includeInactive=${includeInactive}`);
  },

  getById: async (id: string): Promise<SimulationTemplate> => {
    return apiClient.get<SimulationTemplate>(`/admin/simulations/${id}`);
  },

  create: async (data: CreateSimulationRequest): Promise<SimulationTemplate> => {
    return apiClient.post<SimulationTemplate>('/admin/simulations', data);
  },

  update: async (id: string, data: UpdateSimulationRequest): Promise<SimulationTemplate> => {
    return apiClient.put<SimulationTemplate>(`/admin/simulations/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/simulations/${id}`);
  },
};
