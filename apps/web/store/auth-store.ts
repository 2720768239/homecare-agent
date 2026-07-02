'use client';

import { create } from 'zustand';
import type { Session } from '@/lib/types';
import { api } from '@/lib/api-client';

interface AuthState {
  session: Session | null;
  hydrated: boolean;
  error: string | null;
  loading: boolean;
  hydrate: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  error: null,
  loading: false,

  hydrate: () => {
    const session = api.me();
    set({ session, hydrated: true });
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = (await api.login(username, password)) as {
        user: Session;
        token: string;
      };
      set({ session: res.user, loading: false });
      return true;
    } catch (e) {
      const msg =
        (e as { message?: string })?.message || '账号名或密码错误';
      set({ loading: false, error: msg });
      return false;
    }
  },

  logout: () => {
    api.logout();
    set({ session: null });
  },

  clearError: () => set({ error: null }),
}));
