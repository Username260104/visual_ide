import { create } from 'zustand';

export interface PendingDrop {
  imageUrls: string[];
  position: { x: number; y: number };
}

interface UIStore {
  selectedNodeId: string | null;
  isDetailPanelOpen: boolean;
  isSidebarOpen: boolean;
  activeSidebarTab: 'directions' | 'settings';
  detailMode: 'view' | 'variation';
  zoomLevel: number;
  isGenerating: boolean;
  pendingDrop: PendingDrop | null;
  isDirectionDialogOpen: boolean;
  isGenerateDialogOpen: boolean;

  selectNode: (id: string | null) => void;
  toggleSidebar: () => void;
  setDetailMode: (mode: 'view' | 'variation') => void;
  setZoomLevel: (level: number) => void;
  setGenerating: (v: boolean) => void;
  setActiveSidebarTab: (tab: 'directions' | 'settings') => void;
  setPendingDrop: (drop: PendingDrop | null) => void;
  setDirectionDialogOpen: (open: boolean) => void;
  setGenerateDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  isDetailPanelOpen: false,
  isSidebarOpen: true,
  activeSidebarTab: 'directions',
  detailMode: 'view',
  zoomLevel: 1,
  isGenerating: false,
  pendingDrop: null,
  isDirectionDialogOpen: false,
  isGenerateDialogOpen: false,

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
}));
