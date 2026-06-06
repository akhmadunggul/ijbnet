import { create } from 'zustand';
import { api } from '../lib/api';

interface AbStore {
  assignments: Record<string, string>;
  fetched: boolean;
  fetchAssignments: () => Promise<void>;
  clearAssignments: () => void;
  track: (experimentName: string, event: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export const useAbStore = create<AbStore>((set) => ({
  assignments: {},
  fetched: false,

  fetchAssignments: async () => {
    try {
      const { data } = await api.get<{ assignments: Record<string, string> }>('/ab/assignments');
      set({ assignments: data.assignments, fetched: true });
    } catch {
      set({ fetched: true });
    }
  },

  clearAssignments: () => set({ assignments: {}, fetched: false }),

  track: async (experimentName, event, metadata) => {
    try {
      await api.post('/ab/event', { experimentName, event, metadata });
    } catch {
      // silent — tracking failure must never break the UI
    }
  },
}));
