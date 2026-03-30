import { create } from 'zustand';
import { fetchJson, indexById } from '@/lib/clientApi';
import { Direction } from '@/lib/types';
import { useUIStore } from '@/stores/uiStore';

interface DirectionStore {
  directions: Record<string, Direction>;
  projectId: string | null;
  isLoading: boolean;

  loadDirections: (projectId: string) => Promise<void>;
  clearDirections: () => void;

  addDirection: (name: string, color: string) => Promise<Direction>;
  updateDirection: (id: string, updates: Partial<Direction>) => Promise<Direction | null>;
  deleteDirection: (id: string) => Promise<boolean>;
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
      set((state) =>
        state.projectId === projectId
          ? { directions: indexById(directions), isLoading: false }
          : state
      );
    } catch (error) {
      console.error('Failed to load directions:', error);
      set((state) => (state.projectId === projectId ? { isLoading: false } : state));
      throw error;
    }
  },

  clearDirections: () => set({ directions: {}, projectId: null }),

  addDirection: async (name, color) => {
    const projectId = get().projectId;
    if (!projectId) {
      throw new Error('No project loaded');
    }

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

  updateDirection: async (id, updates) => {
    const existing = get().directions[id];
    if (!existing) {
      return null;
    }

    set((state) => ({
      directions: {
        ...state.directions,
        [id]: { ...existing, ...updates },
      },
    }));

    const projectId = get().projectId;
    if (!projectId) {
      set((state) => ({
        directions: {
          ...state.directions,
          [id]: existing,
        },
      }));
      return null;
    }

    try {
      const direction = await fetchJson<Direction>(
        `/api/projects/${projectId}/directions/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      set((state) => ({
        directions: { ...state.directions, [direction.id]: direction },
      }));

      return direction;
    } catch (error) {
      set((state) => ({
        directions: {
          ...state.directions,
          [id]: existing,
        },
      }));
      console.error('Failed to update direction:', error);
      return null;
    }
  },

  deleteDirection: async (id) => {
    const existing = get().directions[id];
    if (!existing) {
      return false;
    }

    const feedbackKey = useUIStore.getState().startSaveFeedback({
      entityType: 'direction',
      entityId: id,
      action: 'delete',
      message: '브랜치 보관 중...',
    });

    const projectId = get().projectId;
    if (!projectId) {
      useUIStore
        .getState()
        .markSaveFeedbackError(feedbackKey, '프로젝트가 로드되지 않았습니다');
      return false;
    }

    try {
      await fetchJson<{ ok: boolean }>(`/api/projects/${projectId}/directions/${id}`, {
        method: 'DELETE',
      });

      set((state) => {
        const { [id]: _removed, ...rest } = state.directions;
        return { directions: rest };
      });

      useUIStore.getState().markSaveFeedbackSuccess(feedbackKey, '브랜치를 보관했습니다.');
      return true;
    } catch (error) {
      useUIStore
        .getState()
        .markSaveFeedbackError(feedbackKey, getDeleteErrorMessage(error));
      console.error('Failed to delete direction:', error);
      return false;
    }
  },
}));

function getDeleteErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '브랜치를 보관하지 못했습니다';
}

