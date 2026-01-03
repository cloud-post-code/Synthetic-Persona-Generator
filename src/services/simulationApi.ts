import { apiClient } from './api.js';
import { SimulationSession } from '../models/types.js';

export const simulationApi = {
  getAll: async (): Promise<SimulationSession[]> => {
    return apiClient.get<SimulationSession[]>('/simulations');
  },

  getById: async (id: string): Promise<SimulationSession> => {
    return apiClient.get<SimulationSession>(`/simulations/${id}`);
  },

  create: async (session: Omit<SimulationSession, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<SimulationSession> => {
    // Validate required fields before transformation
    if (!session.personaId && !session.persona_id) {
      throw new Error('persona_id is required: No persona selected');
    }
    if (!session.mode) {
      throw new Error('mode is required: Simulation mode must be selected');
    }
    if (!session.name || !session.name.trim()) {
      throw new Error('name is required: Simulation name cannot be empty');
    }
    
    // Transform frontend format to backend format
    const payload = {
      persona_id: session.personaId || session.persona_id,
      mode: session.mode,
      bg_info: session.bgInfo !== undefined ? String(session.bgInfo) : (session.bg_info !== undefined ? String(session.bg_info) : ''),
      opening_line: session.openingLine !== undefined ? (session.openingLine || null) : (session.opening_line !== undefined ? (session.opening_line || null) : null),
      stimulus_image: session.stimulusImage !== undefined ? (session.stimulusImage || null) : (session.stimulus_image !== undefined ? (session.stimulus_image || null) : null),
      mime_type: session.mimeType !== undefined ? (session.mimeType || null) : (session.mime_type !== undefined ? (session.mime_type || null) : null),
      name: session.name.trim(),
    };
    
    // Final validation before sending
    if (!payload.persona_id) {
      throw new Error('persona_id is required: Persona ID is missing');
    }
    if (!payload.mode) {
      throw new Error('mode is required: Simulation mode is missing');
    }
    if (!payload.name) {
      throw new Error('name is required: Simulation name is missing');
    }
    if (payload.bg_info === undefined || payload.bg_info === null) {
      payload.bg_info = ''; // Ensure bg_info is at least an empty string
    }
    
    return apiClient.post<SimulationSession>('/simulations', payload);
  },

  update: async (id: string, updates: Partial<SimulationSession>): Promise<SimulationSession> => {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.bgInfo || updates.bg_info) payload.bg_info = updates.bgInfo || updates.bg_info;
    if (updates.openingLine || updates.opening_line) payload.opening_line = updates.openingLine || updates.opening_line;
    if (updates.stimulusImage || updates.stimulus_image) payload.stimulus_image = updates.stimulusImage || updates.stimulus_image;
    if (updates.mimeType || updates.mime_type) payload.mime_type = updates.mimeType || updates.mime_type;
    return apiClient.put<SimulationSession>(`/simulations/${id}`, payload);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/simulations/${id}`);
  },
};

