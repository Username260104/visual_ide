'use client';

import { useMemo } from 'react';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { type SaveFeedbackEntry, useUIStore } from '@/stores/uiStore';

export function StatusBar() {
  const nodeCount = useNodeStore((state) => Object.keys(state.nodes).length);
  const projectId = useNodeStore((state) => state.projectId);
  const directionCount = useDirectionStore(
    (state) => Object.keys(state.directions).length
  );
  const stagingBatches = useStagingStore((state) => state.batches);
  const isTrayOpen = useStagingStore((state) => state.isTrayOpen);
  const setTrayOpen = useStagingStore((state) => state.setTrayOpen);
  const zoomLevel = useUIStore((state) => state.zoomLevel);
  const saveFeedbackByKey = useUIStore((state) => state.saveFeedbackByKey);
  const saveFeedbackEntries = useMemo(
    () => Object.values(saveFeedbackByKey),
    [saveFeedbackByKey]
  );
  const currentProjectBatches = useMemo(
    () =>
      projectId
        ? stagingBatches.filter(
            (batch) =>
              batch.projectId === projectId &&
              batch.candidates.some((candidate) => candidate.status === 'staged')
          )
        : [],
    [projectId, stagingBatches]
  );
  const stagedCandidateCount = useMemo(
    () =>
      currentProjectBatches.reduce(
        (count, batch) =>
          count +
          batch.candidates.filter((candidate) => candidate.status === 'staged').length,
        0
      ),
    [currentProjectBatches]
  );
  const activeFeedback = getActiveFeedback(saveFeedbackEntries);
  const theme = getStatusBarTheme(activeFeedback);
  const primaryMessage = activeFeedback
    ? activeFeedback.message
    : stagedCandidateCount > 0
      ? `staging에 ${stagedCandidateCount}장 대기 중`
      : '준비됨';

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-4 px-3 text-xs transition-colors"
      style={{
        backgroundColor: theme.backgroundColor,
        color: theme.color,
      }}
    >
      <span className="font-medium">{primaryMessage}</span>
      {currentProjectBatches.length > 0 && (
        <span>
          staging {currentProjectBatches.length}배치 / {stagedCandidateCount}장
        </span>
      )}
      {currentProjectBatches.length > 0 && !isTrayOpen && (
        <button
          className="rounded px-2 py-1 font-medium"
          style={{
            backgroundColor: 'rgba(255,255,255,0.14)',
            color: 'var(--text-inverse)',
          }}
          onClick={() => setTrayOpen(true)}
        >
          staging 열기
        </button>
      )}
      <span>노드 {nodeCount}개</span>
      <span>방향 {directionCount}개</span>
      <span className="ml-auto">{Math.round(zoomLevel * 100)}%</span>
    </div>
  );
}

function getActiveFeedback(entries: SaveFeedbackEntry[]) {
  const sorted = [...entries].sort((left, right) => right.updatedAt - left.updatedAt);

  return (
    sorted.find((entry) => entry.status === 'error') ??
    sorted.find((entry) => entry.status === 'saving') ??
    sorted.find((entry) => entry.status === 'saved') ??
    null
  );
}

function getStatusBarTheme(entry: SaveFeedbackEntry | null) {
  if (!entry) {
    return {
      backgroundColor: 'var(--statusbar-bg)',
      color: 'var(--statusbar-fg)',
    };
  }

  if (entry.status === 'error') {
    return {
      backgroundColor: 'var(--status-dropped)',
      color: 'var(--text-inverse)',
    };
  }

  if (entry.status === 'saved') {
    return {
      backgroundColor: 'var(--status-final)',
      color: 'var(--text-inverse)',
    };
  }

  return {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
  };
}
