import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../models/types.js';
import { authApi, RegisterRequest, LoginRequest } from '../services/authApi.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (token exists)
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Token exists, but we don't have user info
      // In a real app, you might want to verify the token and fetch user info
      // For now, we'll just check if token exists
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Failed to parse saved user', e);
        }
      }
    }
    setLoading(false);
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data);
    setUser(response.user);
    localStorage.setItem('auth_user', JSON.stringify(response.user));
  };

  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    setUser(response.user);
    localStorage.setItem('auth_user', JSON.stringify(response.user));
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

