import { create } from 'zustand';
import { fetchJson, indexById } from '@/lib/clientApi';
import { NodeData } from '@/lib/types';
import { type SaveFeedbackAction, useUIStore } from '@/stores/uiStore';

interface NodeMutationFeedback {
  action: SaveFeedbackAction;
  savingMessage: string;
  successMessage?: string;
  errorMessage: string;
}

interface NodeUpdateOptions {
  rollbackOnError?: boolean;
  feedback?: NodeMutationFeedback;
}

interface NodePatchOptions {
  feedback?: NodeMutationFeedback;
}

interface NodeStore {
  nodes: Record<string, NodeData>;
  projectId: string | null;
  isLoading: boolean;

  loadNodes: (projectId: string) => Promise<void>;
  clearNodes: () => void;

  addNode: (node: Partial<NodeData>) => Promise<NodeData>;
  patchNode: (
    id: string,
    updates: Partial<NodeData>,
    options?: NodePatchOptions
  ) => Promise<NodeData>;
  updateNode: (
    id: string,
    updates: Partial<NodeData>,
    options?: NodeUpdateOptions
  ) => Promise<NodeData | null>;
  deleteNode: (id: string) => Promise<boolean>;
  clearDirectionAssignments: (directionId: string) => void;

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
    if (!projectId) {
      throw new Error('No project loaded');
    }

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

  patchNode: async (id, updates, options) => {
    const existing = get().nodes[id];
    if (!existing) {
      throw new Error('Node not found');
    }

    const projectId = get().projectId;
    if (!projectId) {
      throw new Error('No project loaded');
    }

    const feedback = options?.feedback;
    const feedbackKey = feedback
      ? useUIStore.getState().startSaveFeedback({
          entityType: 'node',
          entityId: id,
          action: feedback.action,
          message: feedback.savingMessage,
        })
      : null;

    try {
      const node = await fetchJson<NodeData>(`/api/projects/${projectId}/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      set((state) => ({
        nodes: { ...state.nodes, [node.id]: node },
      }));

      if (feedbackKey) {
        useUIStore
          .getState()
          .markSaveFeedbackSuccess(
            feedbackKey,
            feedback?.successMessage ?? '저장되었습니다'
          );
      }

      return node;
    } catch (error) {
      if (feedbackKey) {
        useUIStore
          .getState()
          .markSaveFeedbackError(
            feedbackKey,
            getMutationErrorMessage(
              error,
              feedback?.errorMessage ?? '저장하지 못했습니다'
            )
          );
      }

      throw error;
    }
  },

  updateNode: async (id, updates, options) => {
    const previousNode = get().nodes[id];
    if (!previousNode) {
      return null;
    }

    const feedback = options?.feedback;
    const feedbackKey = feedback
      ? useUIStore.getState().startSaveFeedback({
          entityType: 'node',
          entityId: id,
          action: feedback.action,
          message: feedback.savingMessage,
        })
      : null;

    set((state) => {
      const current = state.nodes[id];
      if (!current) {
        return state;
      }

      return {
        nodes: {
          ...state.nodes,
          [id]: { ...current, ...updates },
        },
      };
    });

    const projectId = get().projectId;
    if (!projectId) {
      if (options?.rollbackOnError) {
        set((state) => ({
          nodes: { ...state.nodes, [id]: previousNode },
        }));
      }

      if (feedbackKey) {
        useUIStore
          .getState()
          .markSaveFeedbackError(feedbackKey, '프로젝트가 로드되지 않았습니다');
      }

      return null;
    }

    try {
      const node = await fetchJson<NodeData>(`/api/projects/${projectId}/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      set((state) => ({
        nodes: { ...state.nodes, [node.id]: node },
      }));

      if (feedbackKey) {
        useUIStore
          .getState()
          .markSaveFeedbackSuccess(
            feedbackKey,
            feedback?.successMessage ?? '저장되었습니다'
          );
      }

      return node;
    } catch (error) {
      if (options?.rollbackOnError) {
        set((state) => ({
          nodes: { ...state.nodes, [id]: previousNode },
        }));
      }

      if (feedbackKey) {
        useUIStore
          .getState()
          .markSaveFeedbackError(
            feedbackKey,
            getMutationErrorMessage(
              error,
              feedback?.errorMessage ?? '저장하지 못했습니다'
            )
          );
      }

      console.error('Failed to update node:', error);
      return null;
    }
  },

  deleteNode: async (id) => {
    const existing = get().nodes[id];
    if (!existing) {
      return false;
    }

    const feedbackKey = useUIStore.getState().startSaveFeedback({
      entityType: 'node',
      entityId: id,
      action: 'delete',
      message: '노드 삭제 중...',
    });

    const projectId = get().projectId;
    if (!projectId) {
      useUIStore
        .getState()
        .markSaveFeedbackError(feedbackKey, '프로젝트가 로드되지 않았습니다');
      return false;
    }

    try {
      await fetchJson<{ ok: boolean }>(`/api/projects/${projectId}/nodes/${id}`, {
        method: 'DELETE',
      });

      set((state) => {
        const { [id]: _removed, ...rest } = state.nodes;

        return {
          nodes: Object.fromEntries(
            Object.entries(rest).map(([nodeId, node]) => [
              nodeId,
              node.parentNodeId === id
                ? { ...node, parentNodeId: null }
                : node,
            ])
          ),
        };
      });

      useUIStore.getState().markSaveFeedbackSuccess(feedbackKey, '노드가 삭제되었습니다');
      return true;
    } catch (error) {
      useUIStore
        .getState()
        .markSaveFeedbackError(
          feedbackKey,
          getMutationErrorMessage(error, '노드를 삭제하지 못했습니다')
        );
      console.error('Failed to delete node:', error);
      return false;
    }
  },

  clearDirectionAssignments: (directionId) => {
    set((state) => ({
      nodes: Object.fromEntries(
        Object.entries(state.nodes).map(([nodeId, node]) => [
          nodeId,
          node.directionId === directionId
            ? { ...node, directionId: null }
            : node,
        ])
      ),
    }));
  },

  getChildren: (parentId) => {
    return Object.values(get().nodes).filter((node) => node.parentNodeId === parentId);
  },

  getRootNodes: () => {
    return Object.values(get().nodes).filter((node) => node.parentNodeId === null);
  },

  getNodesByDirection: (directionId) => {
    return Object.values(get().nodes).filter((node) => node.directionId === directionId);
  },

  getUnclassifiedNodes: () => {
    return Object.values(get().nodes).filter((node) => node.directionId === null);
  },

  getNextVersionNumber: (directionId) => {
    const nodes = Object.values(get().nodes).filter(
      (node) => node.directionId === directionId
    );
    return nodes.length + 1;
  },
}));

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
