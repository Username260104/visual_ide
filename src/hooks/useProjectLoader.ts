'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const NODE_SYNC_INTERVAL_MS = 2500;

export function useProjectLoader(projectId: string) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState('loading');
      setError(null);
      useUIStore.getState().setBranchFilter({ kind: 'all' });

      try {
        await Promise.all([
          useNodeStore.getState().loadNodes(projectId),
          useDirectionStore.getState().loadDirections(projectId),
        ]);

        if (!cancelled) {
          setLoadState('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setLoadState('error');
          setError(
            loadError instanceof Error
              ? loadError.message
              : '?꾨줈?앺듃 ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??'
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      useUIStore.getState().setBranchFilter({ kind: 'all' });
      useNodeStore.getState().clearNodes();
      useDirectionStore.getState().clearDirections();
    };
  }, [projectId, reloadCount]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    let inFlight = false;

    const refreshNodes = async () => {
      if (inFlight) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      if (useNodeStore.getState().projectId !== projectId) {
        return;
      }

      const hasPendingNodeSave = Object.values(
        useUIStore.getState().saveFeedbackByKey
      ).some(
        (entry) =>
          entry.entityType === 'node' &&
          entry.status === 'saving'
      );

      if (hasPendingNodeSave) {
        return;
      }

      inFlight = true;

      try {
        await useNodeStore.getState().loadNodes(projectId, { silent: true });
      } catch (error) {
        console.error('Failed to refresh nodes:', error);
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshNodes();
    }, NODE_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadState, projectId]);

  return {
    isReady: loadState === 'ready',
    isLoading: loadState === 'loading',
    error,
    reload,
  };
}


