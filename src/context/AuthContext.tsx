import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../models/types.js';
import { ApiClientError } from '../services/api.js';
import { authApi, RegisterRequest, LoginRequest } from '../services/authApi.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const normalizeAdminUser = (raw: User): User => {
      const isAdminValue =
        raw.is_admin === true ||
        raw.is_admin === 'true' ||
        raw.is_admin === 1 ||
        raw.isAdmin === true;
      return {
        ...raw,
        isAdmin: isAdminValue,
        is_admin: isAdminValue,
      };
    };

    const restoreUserFromStorage = (): User | null => {
      const savedUser = localStorage.getItem('auth_user');
      if (!savedUser) return null;
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        return normalizeAdminUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse saved user', e);
        return null;
      }
    };

    void (async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { user: meUser } = await authApi.me();
        if (cancelled) return;
        const userData = normalizeAdminUser(meUser);
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiClientError && (e.status === 401 || e.status === 403)) {
          authApi.logout();
          setUser(null);
          localStorage.removeItem('auth_user');
        } else {
          const fallback = restoreUserFromStorage();
          if (fallback) {
            setUser(fallback);
          } else {
            authApi.logout();
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data);
    const isAdminValue = response.user.is_admin === true || response.user.is_admin === 'true' || response.user.is_admin === 1;
    const userData = {
      ...response.user,
      isAdmin: isAdminValue,
      is_admin: isAdminValue,
    };
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    const isAdminValue = response.user.is_admin === true || response.user.is_admin === 'true' || response.user.is_admin === 1;
    const userData = {
      ...response.user,
      isAdmin: isAdminValue,
      is_admin: isAdminValue,
    };
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
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
        isAdmin: user?.isAdmin === true || user?.is_admin === true || false,
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

