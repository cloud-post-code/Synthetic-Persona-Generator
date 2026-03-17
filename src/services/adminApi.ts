import { apiClient } from './api.js';

export interface UserWithStats {
  id: string;
  username: string;
  email?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  persona_count: number;
  chat_count: number;
}

export interface PersonaWithOwner {
  id: string;
  user_id: string;
  username: string;
  name: string;
  type: string;
  description?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionWithOwner {
  id: string;
  user_id: string;
  username: string;
  name: string;
  message_count: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_users: number;
  total_personas: number;
  total_chat_sessions: number;
  total_messages: number;
  total_simulation_sessions: number;
  admin_users: number;
  unindexed_personas: number;
}

export interface ReindexEvent {
  type: 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  personaName?: string;
  status?: 'success' | 'error';
  error?: string;
  success?: number;
  failed?: number;
}

export const adminApi = {
  getAllUsers: async (): Promise<UserWithStats[]> => {
    return apiClient.get<UserWithStats[]>('/admin/users');
  },

  getAllPersonas: async (): Promise<PersonaWithOwner[]> => {
    return apiClient.get<PersonaWithOwner[]>('/admin/personas');
  },

  getAllChats: async (): Promise<ChatSessionWithOwner[]> => {
    return apiClient.get<ChatSessionWithOwner[]>('/admin/chats');
  },

  getStats: async (): Promise<AdminStats> => {
    return apiClient.get<AdminStats>('/admin/stats');
  },

  createPersona: async (data: { name: string; type: 'synthetic_user' | 'advisor'; description?: string; avatar_url?: string }): Promise<PersonaWithOwner> => {
    return apiClient.post<PersonaWithOwner>('/admin/personas', data);
  },

  reindexAllPersonas: async (): Promise<{ message: string; count: number }> => {
    return apiClient.post<{ message: string; count: number }>('/admin/reindex-all', {});
  },

  reindexAllPersonasStream: async (onEvent: (event: ReindexEvent) => void): Promise<void> => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${baseUrl}/admin/reindex-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: '{}',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.message || err.error || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming not supported');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            onEvent(JSON.parse(line));
          } catch { /* skip malformed lines */ }
        }
      }
    }
    if (buffer.trim()) {
      try {
        onEvent(JSON.parse(buffer));
      } catch { /* skip */ }
    }
  },
};


