import { create } from 'zustand';
import { fetchJson, indexById } from '@/lib/clientApi';
import { NodeData } from '@/lib/types';

interface NodeStore {
  nodes: Record<string, NodeData>;
  projectId: string | null;
  isLoading: boolean;

  loadNodes: (projectId: string) => Promise<void>;
  clearNodes: () => void;

  addNode: (node: Partial<NodeData>) => Promise<NodeData>;
  patchNode: (id: string, updates: Partial<NodeData>) => Promise<NodeData>;
  updateNode: (id: string, updates: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;

  getChildren: (parentId: string) => NodeData[];
  getRootNodes: () => NodeData[];
  getNodesByDirection: (directionId: string) => NodeData[];
  getUnclassifiedNodes: () => NodeData[];
  getNextVersionNumber: (directionId: string | null) => number;
}

export const useNodeStore = create<NodeStore>((set, get) => ({
  nodes: {},
  projectId: null,
  isLoading: false,

  loadNodes: async (projectId) => {
    set({ isLoading: true, projectId });
    try {
      const nodes = await fetchJson<NodeData[]>(`/api/projects/${projectId}/nodes`);
      set({ nodes: indexById(nodes), isLoading: false });
    } catch (error) {
      console.error('Failed to load nodes:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  clearNodes: () => set({ nodes: {}, projectId: null }),

  addNode: async (partial) => {
    const { projectId } = get();
    if (!projectId) throw new Error('No project loaded');

    const node = await fetchJson<NodeData>(`/api/projects/${projectId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });

    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    }));
    return node;
  },

  patchNode: async (id, updates) => {
    const { projectId } = get();
    if (!projectId) {
      throw new Error('No project loaded');
    }

    const node = await fetchJson<NodeData>(`/api/projects/${projectId}/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    }));

    return node;
  },

  updateNode: (id, updates) => {
    // Optimistic update
    set((state) => {
      const existing = state.nodes[id];
      if (!existing) return state;
      return {
        nodes: { ...state.nodes, [id]: { ...existing, ...updates } },
      };
    });

    // Sync to server
    const { projectId } = get();
    if (projectId) {
      fetchJson<NodeData>(`/api/projects/${projectId}/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
        .then((node) => {
          set((state) => ({
            nodes: { ...state.nodes, [node.id]: node },
          }));
        })
        .catch((err) => console.error('Failed to update node:', err));
    }
  },

  deleteNode: (id) => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.nodes;
      return { nodes: rest };
    });

    const { projectId } = get();
    if (projectId) {
      fetchJson<{ ok: boolean }>(`/api/projects/${projectId}/nodes/${id}`, {
        method: 'DELETE',
      }).catch((err) => console.error('Failed to delete node:', err));
    }
  },

  getChildren: (parentId) => {
    return Object.values(get().nodes).filter(
      (n) => n.parentNodeId === parentId
    );
  },

  getRootNodes: () => {
    return Object.values(get().nodes).filter(
      (n) => n.parentNodeId === null
    );
  },

  getNodesByDirection: (directionId) => {
    return Object.values(get().nodes).filter(
      (n) => n.directionId === directionId
    );
  },

  getUnclassifiedNodes: () => {
    return Object.values(get().nodes).filter(
      (n) => n.directionId === null
    );
  },

  getNextVersionNumber: (directionId) => {
    const nodes = Object.values(get().nodes).filter(
      (n) => n.directionId === directionId
    );
    return nodes.length + 1;
  },
}));
