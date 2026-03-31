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

  loadNodes: (projectId: string, options?: { silent?: boolean }) => Promise<void>;
  clearNodes: () => void;
  hasPendingMutations: () => boolean;

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

interface SaveFeedbackHandle {
  key: string;
  updatedAt: number;
}

interface NodeMutationOperation {
  optimistic: boolean;
  rollbackOnError: boolean;
  feedback?: NodeMutationFeedback;
  feedbackHandle: SaveFeedbackHandle | null;
  returnNullOnError: boolean;
  resolve: (value: NodeData | null) => void;
  reject: (reason?: unknown) => void;
}

interface NodeMutationBatch {
  nodeId: string;
  projectId: string;
  sessionId: number;
  requestUpdates: Partial<NodeData>;
  optimisticUpdates: Partial<NodeData>;
  rollbackSnapshot: Partial<NodeData>;
  operations: NodeMutationOperation[];
}

interface NodeMutationQueue {
  inFlight: NodeMutationBatch | null;
  queued: NodeMutationBatch | null;
}

const nodeMutationQueues = new Map<string, NodeMutationQueue>();
let nodeStoreSessionId = 0;
const DEFAULT_SAVE_SUCCESS_MESSAGE = '저장되었습니다.';
const DEFAULT_SAVE_ERROR_MESSAGE = '저장하지 못했습니다.';
const DEFAULT_DELETE_SAVING_MESSAGE = '노드 삭제 중...';
const DEFAULT_DELETE_SUCCESS_MESSAGE = '노드가 삭제되었습니다.';
const DEFAULT_DELETE_ERROR_MESSAGE = '노드를 삭제하지 못했습니다.';
const PROJECT_NOT_LOADED_MESSAGE = '프로젝트가 로드되지 않았습니다.';
const NODE_MUTATION_CANCELLED_MESSAGE = '진행 중이던 저장이 취소되었습니다.';

export const useNodeStore = create<NodeStore>((set, get) => ({
  nodes: {},
  projectId: null,
  isLoading: false,

  loadNodes: async (projectId, options) => {
    if (options?.silent) {
      set({ projectId });
    } else {
      set({ isLoading: true, projectId });
    }

    try {
      const nodes = await fetchJson<NodeData[]>(`/api/projects/${projectId}/nodes`);
      set((state) =>
        state.projectId === projectId
          ? {
              nodes: indexById(nodes),
              projectId,
              isLoading: options?.silent ? state.isLoading : false,
            }
          : state
      );
    } catch (error) {
      console.error('Failed to load nodes:', error);
      if (!options?.silent) {
        set((state) => (state.projectId === projectId ? { isLoading: false } : state));
      }
      throw error;
    }
  },

  clearNodes: () => {
    clearNodeMutationQueues();
    set({ nodes: {}, projectId: null });
  },

  hasPendingMutations: () => nodeMutationQueues.size > 0,

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

    const feedbackHandle = startNodeSaveFeedback(id, options?.feedback);
    const result = await enqueueNodeMutation({
      id,
      projectId,
      updates,
      optimistic: false,
      rollbackOnError: false,
      rollbackSource: null,
      feedback: options?.feedback,
      feedbackHandle,
      returnNullOnError: false,
    });

    if (!result) {
      throw new Error('Failed to patch node');
    }

    return result;
  },

  updateNode: async (id, updates, options) => {
    const previousNode = get().nodes[id];
    if (!previousNode) {
      return null;
    }

    const feedbackHandle = startNodeSaveFeedback(id, options?.feedback);
    const projectId = get().projectId;
    if (!projectId) {
      markNodeSaveFeedbackError(
        feedbackHandle,
        options?.feedback?.errorMessage ?? PROJECT_NOT_LOADED_MESSAGE
      );
      return null;
    }

    set((state) => {
      const current = state.nodes[id];
      if (!current) {
        return state;
      }

      return {
        nodes: {
          ...state.nodes,
          [id]: applyNodeUpdates(current, updates),
        },
      };
    });

    return enqueueNodeMutation({
      id,
      projectId,
      updates,
      optimistic: true,
      rollbackOnError: options?.rollbackOnError ?? false,
      rollbackSource: previousNode,
      feedback: options?.feedback,
      feedbackHandle,
      returnNullOnError: true,
    });
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
      message: DEFAULT_DELETE_SAVING_MESSAGE,
    });

    const projectId = get().projectId;
    if (!projectId) {
      useUIStore.getState().markSaveFeedbackError(feedbackKey, PROJECT_NOT_LOADED_MESSAGE);
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
              node.parentNodeId === id ? { ...node, parentNodeId: null } : node,
            ])
          ),
        };
      });

      useUIStore
        .getState()
        .markSaveFeedbackSuccess(feedbackKey, DEFAULT_DELETE_SUCCESS_MESSAGE);
      return true;
    } catch (error) {
      useUIStore
        .getState()
        .markSaveFeedbackError(
          feedbackKey,
          getMutationErrorMessage(error, DEFAULT_DELETE_ERROR_MESSAGE)
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
          node.directionId === directionId ? { ...node, directionId: null } : node,
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

function clearNodeMutationQueues() {
  for (const queue of Array.from(nodeMutationQueues.values())) {
    clearBatchFeedback(queue.inFlight);
    clearBatchFeedback(queue.queued);
    cancelQueuedBatch(queue.queued);
  }

  nodeMutationQueues.clear();
  nodeStoreSessionId += 1;
}

function createNodeMutationBatch(
  nodeId: string,
  projectId: string,
  sessionId: number
): NodeMutationBatch {
  return {
    nodeId,
    projectId,
    sessionId,
    requestUpdates: {},
    optimisticUpdates: {},
    rollbackSnapshot: {},
    operations: [],
  };
}

function getOrCreateNodeMutationQueue(nodeId: string) {
  const existing = nodeMutationQueues.get(nodeId);
  if (existing) {
    return existing;
  }

  const created: NodeMutationQueue = {
    inFlight: null,
    queued: null,
  };
  nodeMutationQueues.set(nodeId, created);
  return created;
}

function clearBatchFeedback(batch: NodeMutationBatch | null) {
  if (!batch) {
    return;
  }

  const uiStore = useUIStore.getState();
  for (const operation of batch.operations) {
    if (operation.feedbackHandle) {
      uiStore.clearSaveFeedback(operation.feedbackHandle.key);
    }
  }
}

function cancelQueuedBatch(batch: NodeMutationBatch | null) {
  if (!batch) {
    return;
  }

  const error = new Error(NODE_MUTATION_CANCELLED_MESSAGE);
  for (const operation of batch.operations) {
    if (operation.returnNullOnError) {
      operation.resolve(null);
      continue;
    }

    operation.reject(error);
  }
}

function startNodeSaveFeedback(
  nodeId: string,
  feedback?: NodeMutationFeedback
): SaveFeedbackHandle | null {
  if (!feedback) {
    return null;
  }

  const key = useUIStore.getState().startSaveFeedback({
    entityType: 'node',
    entityId: nodeId,
    action: feedback.action,
    message: feedback.savingMessage,
  });
  const entry = useUIStore.getState().saveFeedbackByKey[key];

  return {
    key,
    updatedAt: entry?.updatedAt ?? Date.now(),
  };
}

function markNodeSaveFeedbackSuccess(
  feedbackHandle: SaveFeedbackHandle | null,
  message: string
) {
  if (!feedbackHandle) {
    return;
  }

  const entry = useUIStore.getState().saveFeedbackByKey[feedbackHandle.key];
  if (
    !entry ||
    entry.status !== 'saving' ||
    entry.updatedAt !== feedbackHandle.updatedAt
  ) {
    return;
  }

  useUIStore.getState().markSaveFeedbackSuccess(feedbackHandle.key, message);
}

function markNodeSaveFeedbackError(
  feedbackHandle: SaveFeedbackHandle | null,
  message: string
) {
  if (!feedbackHandle) {
    return;
  }

  const entry = useUIStore.getState().saveFeedbackByKey[feedbackHandle.key];
  if (
    !entry ||
    entry.status !== 'saving' ||
    entry.updatedAt !== feedbackHandle.updatedAt
  ) {
    return;
  }

  useUIStore.getState().markSaveFeedbackError(feedbackHandle.key, message);
}

function applyNodeUpdates(node: NodeData, updates: Partial<NodeData>): NodeData {
  return {
    ...node,
    ...updates,
    position: updates.position ?? node.position,
  };
}

function mergeNodeUpdates(
  current: Partial<NodeData>,
  next: Partial<NodeData>
): Partial<NodeData> {
  return {
    ...current,
    ...next,
    ...(next.position ? { position: next.position } : {}),
  };
}

function enqueueNodeMutation({
  id,
  projectId,
  updates,
  optimistic,
  rollbackOnError,
  rollbackSource,
  feedback,
  feedbackHandle,
  returnNullOnError,
}: {
  id: string;
  projectId: string;
  updates: Partial<NodeData>;
  optimistic: boolean;
  rollbackOnError: boolean;
  rollbackSource: NodeData | null;
  feedback?: NodeMutationFeedback;
  feedbackHandle: SaveFeedbackHandle | null;
  returnNullOnError: boolean;
}) {
  return new Promise<NodeData | null>((resolve, reject) => {
    const queue = getOrCreateNodeMutationQueue(id);
    const sessionId = nodeStoreSessionId;
    let shouldStartProcessing = false;

    if (!queue.inFlight) {
      queue.inFlight = createNodeMutationBatch(id, projectId, sessionId);
      shouldStartProcessing = true;
    }

    const batch =
      queue.inFlight && !shouldStartProcessing
        ? queue.queued ?? createNodeMutationBatch(id, projectId, sessionId)
        : queue.inFlight;

    if (!batch) {
      reject(new Error('Failed to initialize node mutation batch.'));
      return;
    }

    if (queue.inFlight && !shouldStartProcessing && !queue.queued) {
      queue.queued = batch;
    }

    batch.requestUpdates = mergeNodeUpdates(batch.requestUpdates, updates);

    if (optimistic) {
      batch.optimisticUpdates = mergeNodeUpdates(batch.optimisticUpdates, updates);
      batch.rollbackSnapshot = extendRollbackSnapshot(
        batch.rollbackSnapshot,
        rollbackSource,
        updates
      );
    }

    batch.operations.push({
      optimistic,
      rollbackOnError,
      feedback,
      feedbackHandle,
      returnNullOnError,
      resolve,
      reject,
    });

    if (shouldStartProcessing) {
      void processNodeMutationQueue(id);
    }
  });
}

async function processNodeMutationQueue(nodeId: string) {
  const queue = nodeMutationQueues.get(nodeId);
  const batch = queue?.inFlight;
  if (!queue || !batch) {
    return;
  }

  try {
    const node = await fetchJson<NodeData>(`/api/projects/${batch.projectId}/nodes/${nodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.requestUpdates),
    });

    syncNodeAfterMutationSuccess(batch, node);

    for (const operation of batch.operations) {
      markNodeSaveFeedbackSuccess(
        operation.feedbackHandle,
        operation.feedback?.successMessage ?? DEFAULT_SAVE_SUCCESS_MESSAGE
      );
      operation.resolve(node);
    }
  } catch (error) {
    reconcileNodeAfterMutationError(batch);

    for (const operation of batch.operations) {
      markNodeSaveFeedbackError(
        operation.feedbackHandle,
        getMutationErrorMessage(
          error,
          operation.feedback?.errorMessage ?? DEFAULT_SAVE_ERROR_MESSAGE
        )
      );

      if (operation.returnNullOnError) {
        operation.resolve(null);
      } else {
        operation.reject(error);
      }
    }

    console.error('Failed to update node:', error);
  } finally {
    const latestQueue = nodeMutationQueues.get(nodeId);
    if (!latestQueue || latestQueue.inFlight !== batch) {
      return;
    }

    latestQueue.inFlight = latestQueue.queued;
    latestQueue.queued = null;

    if (latestQueue.inFlight) {
      void processNodeMutationQueue(nodeId);
    } else {
      nodeMutationQueues.delete(nodeId);
    }
  }
}

function syncNodeAfterMutationSuccess(batch: NodeMutationBatch, node: NodeData) {
  if (batch.sessionId !== nodeStoreSessionId) {
    return;
  }

  const queuedOptimisticUpdates =
    nodeMutationQueues.get(batch.nodeId)?.queued?.optimisticUpdates ?? null;
  const nextNode = queuedOptimisticUpdates
    ? applyNodeUpdates(node, queuedOptimisticUpdates)
    : node;

  useNodeStore.setState((state) => {
    if (state.projectId !== batch.projectId || !state.nodes[batch.nodeId]) {
      return state;
    }

    return {
      nodes: {
        ...state.nodes,
        [batch.nodeId]: nextNode,
      },
    };
  });
}

function reconcileNodeAfterMutationError(batch: NodeMutationBatch) {
  if (batch.sessionId !== nodeStoreSessionId) {
    return;
  }

  const shouldRollback = batch.operations.some(
    (operation) => operation.optimistic && operation.rollbackOnError
  );

  if (!shouldRollback || !hasRollbackSnapshot(batch.rollbackSnapshot)) {
    return;
  }

  const queuedOptimisticUpdates =
    nodeMutationQueues.get(batch.nodeId)?.queued?.optimisticUpdates ?? null;

  useNodeStore.setState((state) => {
    const currentNode = state.nodes[batch.nodeId];
    if (state.projectId !== batch.projectId || !currentNode) {
      return state;
    }

    const rolledBackNode = applyNodeUpdates(currentNode, batch.rollbackSnapshot);
    const nextNode = queuedOptimisticUpdates
      ? applyNodeUpdates(rolledBackNode, queuedOptimisticUpdates)
      : rolledBackNode;

    return {
      nodes: {
        ...state.nodes,
        [batch.nodeId]: nextNode,
      },
    };
  });
}

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function extendRollbackSnapshot(
  snapshot: Partial<NodeData>,
  source: NodeData | null,
  updates: Partial<NodeData>
) {
  if (!source) {
    return snapshot;
  }

  let nextSnapshot = snapshot;

  for (const key of Object.keys(updates) as Array<keyof NodeData>) {
    if (updates[key] === undefined || Object.prototype.hasOwnProperty.call(nextSnapshot, key)) {
      continue;
    }

    if (key === 'position') {
      nextSnapshot = {
        ...nextSnapshot,
        position: { ...source.position },
      };
      continue;
    }

    nextSnapshot = {
      ...nextSnapshot,
      [key]: source[key],
    };
  }

  return nextSnapshot;
}

function hasRollbackSnapshot(snapshot: Partial<NodeData>) {
  return Object.keys(snapshot).length > 0;
}
