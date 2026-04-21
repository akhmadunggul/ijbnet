import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@ijbnet/shared';
import { useSelectionStore } from './selectionStore';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      login: (accessToken, user) => set({ accessToken, user }),
      logout: () => {
        useSelectionStore.getState().clearAll();
        set({ accessToken: null, user: null });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'ijbnet-auth',
      // Never persist accessToken — keep it in memory only
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
