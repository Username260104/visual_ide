import { create } from 'zustand';

export interface PendingDrop {
  imageUrls: string[];
  position: { x: number; y: number };
}

export type SidebarTab =
  | 'image-generation'
  | 'image-bridge'
  | 'branches'
  | 'strategy'
  | 'activity'
  | 'archive'
  | 'settings';

export type SaveFeedbackEntityType = 'node' | 'direction' | 'project' | 'staging';

export type SaveFeedbackAction =
  | 'note'
  | 'status'
  | 'direction'
  | 'position'
  | 'delete'
  | 'restore'
  | 'accept'
  | 'update'
  | 'feedback'
  | 'decision'
  | 'bulk-delete';

export type SaveFeedbackStatus = 'saving' | 'saved' | 'error';

export interface SaveFeedbackEntry {
  key: string;
  entityType: SaveFeedbackEntityType;
  entityId: string;
  action: SaveFeedbackAction;
  status: SaveFeedbackStatus;
  message: string;
  updatedAt: number;
}

interface SaveFeedbackSeed {
  entityType: SaveFeedbackEntityType;
  entityId: string;
  action: SaveFeedbackAction;
  message: string;
}

interface UIStore {
  selectedNodeId: string | null;
  isDetailPanelOpen: boolean;
  isSidebarOpen: boolean;
  activeSidebarTab: SidebarTab;
  detailMode: 'view' | 'variation';
  zoomLevel: number;
  isGenerating: boolean;
  pendingDrop: PendingDrop | null;
  isDirectionDialogOpen: boolean;
  isGenerateDialogOpen: boolean;
  saveFeedbackByKey: Record<string, SaveFeedbackEntry>;

  selectNode: (id: string | null) => void;
  toggleSidebar: () => void;
  setDetailMode: (mode: 'view' | 'variation') => void;
  setZoomLevel: (level: number) => void;
  setGenerating: (v: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setPendingDrop: (drop: PendingDrop | null) => void;
  setDirectionDialogOpen: (open: boolean) => void;
  setGenerateDialogOpen: (open: boolean) => void;
  startSaveFeedback: (seed: SaveFeedbackSeed) => string;
  markSaveFeedbackSuccess: (key: string, message?: string) => void;
  markSaveFeedbackError: (key: string, message: string) => void;
  clearSaveFeedback: (key: string) => void;
}

const SUCCESS_CLEAR_DELAY_MS = 1800;
const feedbackTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function createSaveFeedbackKey(
  entityType: SaveFeedbackEntityType,
  entityId: string,
  action: SaveFeedbackAction
) {
  return `${entityType}:${entityId}:${action}`;
}

function clearFeedbackTimer(key: string) {
  const timer = feedbackTimers.get(key);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  feedbackTimers.delete(key);
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  isDetailPanelOpen: false,
  isSidebarOpen: true,
  activeSidebarTab: 'branches',
  detailMode: 'view',
  zoomLevel: 1,
  isGenerating: false,
  pendingDrop: null,
  isDirectionDialogOpen: false,
  isGenerateDialogOpen: false,
  saveFeedbackByKey: {},

  selectNode: (id) =>
    set({
      selectedNodeId: id,
      isDetailPanelOpen: id !== null,
      detailMode: 'view',
    }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setDetailMode: (mode) => set({ detailMode: mode }),

  setZoomLevel: (level) => set({ zoomLevel: level }),

  setGenerating: (v) => set({ isGenerating: v }),

  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  setPendingDrop: (drop) => set({ pendingDrop: drop }),

  setDirectionDialogOpen: (open) => set({ isDirectionDialogOpen: open }),

  setGenerateDialogOpen: (open) => set({ isGenerateDialogOpen: open }),

  startSaveFeedback: (seed) => {
    const key = createSaveFeedbackKey(seed.entityType, seed.entityId, seed.action);
    clearFeedbackTimer(key);

    set((state) => ({
      saveFeedbackByKey: {
        ...state.saveFeedbackByKey,
        [key]: {
          key,
          entityType: seed.entityType,
          entityId: seed.entityId,
          action: seed.action,
          status: 'saving',
          message: seed.message,
          updatedAt: Date.now(),
        },
      },
    }));

    return key;
  },

  markSaveFeedbackSuccess: (key, message) => {
    clearFeedbackTimer(key);
    const updatedAt = Date.now();

    set((state) => {
      const existing = state.saveFeedbackByKey[key];
      if (!existing) {
        return state;
      }

      return {
        saveFeedbackByKey: {
          ...state.saveFeedbackByKey,
          [key]: {
            ...existing,
            status: 'saved',
            message: message ?? existing.message,
            updatedAt,
          },
        },
      };
    });

    const timer = setTimeout(() => {
      set((state) => {
        const existing = state.saveFeedbackByKey[key];
        if (!existing || existing.status !== 'saved' || existing.updatedAt !== updatedAt) {
          return state;
        }

        const { [key]: _removed, ...rest } = state.saveFeedbackByKey;
        return { saveFeedbackByKey: rest };
      });
      feedbackTimers.delete(key);
    }, SUCCESS_CLEAR_DELAY_MS);

    feedbackTimers.set(key, timer);
  },

  markSaveFeedbackError: (key, message) => {
    clearFeedbackTimer(key);

    set((state) => {
      const existing = state.saveFeedbackByKey[key];
      if (!existing) {
        return state;
      }

      return {
        saveFeedbackByKey: {
          ...state.saveFeedbackByKey,
          [key]: {
            ...existing,
            status: 'error',
            message,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  clearSaveFeedback: (key) => {
    clearFeedbackTimer(key);

    set((state) => {
      if (!state.saveFeedbackByKey[key]) {
        return state;
      }

      const { [key]: _removed, ...rest } = state.saveFeedbackByKey;
      return { saveFeedbackByKey: rest };
    });
  },
}));
