import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

interface MeUser {
  id: string;
  email: string | null;
  phone: string | null;
  is_admin: boolean;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  interests: string[];
}

interface VerifiedCohort {
  id: string;
  birth_year: number;
  label: string;
  is_primary: boolean;
}

interface AuthContextValue {
  user: MeUser | null;
  verifiedCohorts: VerifiedCohort[];
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, displayName: string, dateOfBirth: string, avatarUrl?: string, bio?: string, interests?: string[]) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [verifiedCohorts, setVerifiedCohorts] = useState<VerifiedCohort[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('generation_token');
    if (!token) {
      setUser(null);
      setVerifiedCohorts([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/me');
      setUser(res.data.user);
      setVerifiedCohorts(res.data.verifiedCohorts ?? []);
    } catch {
      localStorage.removeItem('generation_token');
      setUser(null);
      setVerifiedCohorts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await api.post('/auth/login', { phone, password });
      localStorage.setItem('generation_token', res.data.token);
      await refreshMe();
    },
    [refreshMe]
  );

  const register = useCallback(
    async (phone: string, password: string, displayName: string, dateOfBirth: string, avatarUrl?: string, bio?: string, interests?: string[]) => {
      const res = await api.post('/auth/register', { phone, password, displayName, dateOfBirth });
      localStorage.setItem('generation_token', res.data.token);
      await refreshMe();
      if (avatarUrl || bio || interests?.length) {
        await api.patch('/profile', { ...(avatarUrl ? { avatarUrl } : {}), ...(bio ? { bio } : {}), ...(interests?.length ? { interests } : {}) });
        await refreshMe();
      }
    },
    [refreshMe]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('generation_token');
    setUser(null);
    setVerifiedCohorts([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, verifiedCohorts, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
