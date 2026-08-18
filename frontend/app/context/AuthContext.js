'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../utils/api';

const AuthContext = createContext(null);

const PUBLIC_PATHS = ['/login', '/register'];

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data.authenticated) {
        setUser(res.data.user);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('unauthenticated');
      if (!PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) {
        router.replace('/login');
      }
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [pathname, router]);

  useEffect(() => {
    if (status === 'loading') return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
    if (status === 'unauthenticated' && !isPublic) {
      router.replace('/login');
    } else if (status === 'authenticated' && isPublic) {
      router.replace('/');
    }
  }, [status, pathname, router]);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    setUser(res.data.user);
    setStatus('authenticated');
    return res.data;
  };

  const register = async (payload) => {
    const res = await api.post('/api/auth/register', payload);
    setUser(res.data.user);
    setStatus('authenticated');
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      router.replace('/login');
    }
  };

  const updateProfile = async (name) => {
    const res = await api.patch('/api/auth/me', { name });
    setUser(res.data.user);
    return res.data;
  };

  const changePassword = async (payload) => {
    const res = await api.post('/api/auth/change-password', payload);
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{ status, user, login, register, logout, refresh, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
