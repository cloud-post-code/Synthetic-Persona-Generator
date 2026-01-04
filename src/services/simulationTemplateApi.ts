import { apiClient } from './api.js';

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
  created_at: string;
  updated_at: string;
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

export const simulationTemplateApi = {
  // Public endpoint - get active simulations
  getAll: async (): Promise<SimulationTemplate[]> => {
    return apiClient.get<SimulationTemplate[]>('/simulations/templates');
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

