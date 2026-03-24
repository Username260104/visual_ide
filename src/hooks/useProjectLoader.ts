'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function useProjectLoader(projectId: string) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const loadNodes = useNodeStore((state) => state.loadNodes);
  const clearNodes = useNodeStore((state) => state.clearNodes);
  const loadDirections = useDirectionStore((state) => state.loadDirections);
  const clearDirections = useDirectionStore((state) => state.clearDirections);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState('loading');
      setError(null);

      try {
        await Promise.all([loadNodes(projectId), loadDirections(projectId)]);

        if (!cancelled) {
          setLoadState('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setLoadState('error');
          setError(
            loadError instanceof Error
              ? loadError.message
              : '프로젝트 데이터를 불러오지 못했습니다.'
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      clearNodes();
      clearDirections();
    };
  }, [
    projectId,
    reloadCount,
    loadNodes,
    clearNodes,
    loadDirections,
    clearDirections,
  ]);

  return {
    isReady: loadState === 'ready',
    isLoading: loadState === 'loading',
    error,
    reload,
  };
}
