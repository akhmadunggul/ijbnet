import { create } from 'zustand';

interface SelectionStore {
  batchId: string | null;
  selectedIds: Set<string>;
  limit: number;
  quota: number;
  initialize: (batchId: string, selectedIds: string[], limit: number, quota: number) => void;
  toggleSelect: (candidateId: string, isConfirmed: boolean) => void;
  clearAll: () => void;
  isAtLimit: () => boolean;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  batchId: null,
  selectedIds: new Set<string>(),
  limit: 0,
  quota: 0,

  initialize: (batchId, selectedIds, limit, quota) =>
    set({ batchId, selectedIds: new Set(selectedIds), limit, quota }),

  toggleSelect: (candidateId, isConfirmed) => {
    if (isConfirmed) return;
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        if (next.size >= state.limit) return state; // quota full
        next.add(candidateId);
      }
      return { selectedIds: next };
    });
  },

  clearAll: () => set({ selectedIds: new Set<string>() }),

  isAtLimit: () => {
    const { selectedIds, limit } = get();
    return selectedIds.size >= limit;
  },
}));
