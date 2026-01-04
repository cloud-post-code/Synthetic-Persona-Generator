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
};

