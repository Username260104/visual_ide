'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/clientApi';
import type { Project } from '@/lib/types';

interface ProjectStrategyState {
  project: Project | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_STATE: ProjectStrategyState = {
  project: null,
  isLoading: false,
  error: null,
};

export function useProjectStrategy(projectId: string | null) {
  const [state, setState] = useState<ProjectStrategyState>(EMPTY_STATE);

  useEffect(() => {
    if (!projectId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    setState((current) => ({
      project:
        current.project?.id === projectId ? current.project : null,
      isLoading: true,
      error: null,
    }));

    void fetchJson<Project>(`/api/projects/${projectId}`)
      .then((project) => {
        if (cancelled) {
          return;
        }

        setState({
          project,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          project: null,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : '프로젝트 전략 정보를 불러오지 못했습니다.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return state;
}
