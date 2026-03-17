import { apiClient } from './api.js';

export interface AgentTurnRequest {
  personaId: string;
  personaIds?: string[];
  sessionId?: string;
  history: { role: 'user' | 'model'; text: string }[];
  userMessage: string;
  simulationInstructions?: string;
  image?: string;
  mimeType?: string;
}

export interface AgentTurnResponse {
  response: string;
  thinking: string;
}

export const agentApi = {
  turn: async (params: AgentTurnRequest): Promise<AgentTurnResponse> => {
    return apiClient.post<AgentTurnResponse>('/agent/turn', params);
  },

  indexContext: async (sessionId: string, fields: Record<string, string>): Promise<void> => {
    await apiClient.post('/agent/index-context', { sessionId, fields });
  },

  retrieve: async (
    query: string,
    personaIds: string[],
    sessionId?: string,
    topK?: number
  ): Promise<{ chunks: { text: string; source_type: string; source_name: string; score: number }[] }> => {
    return apiClient.post('/agent/retrieve', { query, personaIds, sessionId, topK });
  },

  indexUnindexed: async (): Promise<{ message: string; indexed: number }> => {
    return apiClient.post('/agent/index-unindexed', {});
  },
};
