import { create } from 'zustand';
import { api } from '../lib/api';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

interface AbStore {
  assignments: Record<string, string>;
  fetched: boolean;
  fetchedAt: number | null;
  fetchAssignments: (force?: boolean) => Promise<void>;
  clearAssignments: () => void;
  track: (experimentName: string, event: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export const useAbStore = create<AbStore>((set, get) => ({
  assignments: {},
  fetched: false,
  fetchedAt: null,

  fetchAssignments: async (force = false) => {
    const { fetched, fetchedAt } = get();
    const stale = !fetchedAt || (Date.now() - fetchedAt) > STALE_MS;
    if (fetched && !stale && !force) return;

    try {
      const { data } = await api.get<{ assignments: Record<string, string> }>('/ab/assignments');
      set({ assignments: data.assignments, fetched: true, fetchedAt: Date.now() });
    } catch {
      set({ fetched: true, fetchedAt: Date.now() });
    }
  },

  clearAssignments: () => set({ assignments: {}, fetched: false, fetchedAt: null }),

  track: async (experimentName, event, metadata) => {
    try {
      await api.post('/ab/event', { experimentName, event, metadata });
    } catch {
      // silent — tracking failure must never break the UI
    }
  },
}));
