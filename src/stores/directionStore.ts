import { create } from 'zustand';
import { fetchJson, indexById } from '@/lib/clientApi';
import { Direction } from '@/lib/types';

interface DirectionStore {
  directions: Record<string, Direction>;
  projectId: string | null;
  isLoading: boolean;

  loadDirections: (projectId: string) => Promise<void>;
  clearDirections: () => void;

  addDirection: (name: string, color: string) => Promise<Direction>;
  updateDirection: (id: string, updates: Partial<Direction>) => void;
  deleteDirection: (id: string) => void;
}

export const useDirectionStore = create<DirectionStore>((set, get) => ({
  directions: {},
  projectId: null,
  isLoading: false,

  loadDirections: async (projectId) => {
    set({ isLoading: true, projectId });
    try {
      const directions = await fetchJson<Direction[]>(
        `/api/projects/${projectId}/directions`
      );
      set({ directions: indexById(directions), isLoading: false });
    } catch (error) {
      console.error('Failed to load directions:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  clearDirections: () => set({ directions: {}, projectId: null }),

  addDirection: async (name, color) => {
    const { projectId } = get();
    if (!projectId) throw new Error('No project loaded');

    const direction = await fetchJson<Direction>(
      `/api/projects/${projectId}/directions`,
      {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
      }
    );

    set((state) => ({
      directions: { ...state.directions, [direction.id]: direction },
    }));
    return direction;
  },

  updateDirection: (id, updates) => {
    set((state) => {
      const existing = state.directions[id];
      if (!existing) return state;
      return {
        directions: { ...state.directions, [id]: { ...existing, ...updates } },
      };
    });

    const { projectId } = get();
    if (projectId) {
      fetchJson<Direction>(`/api/projects/${projectId}/directions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
        .then((direction) => {
          set((state) => ({
            directions: { ...state.directions, [direction.id]: direction },
          }));
        })
        .catch((err) => console.error('Failed to update direction:', err));
    }
  },

  deleteDirection: (id) => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.directions;
      return { directions: rest };
    });

    const { projectId } = get();
    if (projectId) {
      fetchJson<{ ok: boolean }>(`/api/projects/${projectId}/directions/${id}`, {
        method: 'DELETE',
      }).catch((err) => console.error('Failed to delete direction:', err));
    }
  },
}));
