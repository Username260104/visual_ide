'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/clientApi';
import { STATUS_LABELS } from '@/lib/constants';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { getNodeDisplayPrompt } from '@/lib/promptProvenance';
import { Direction, NodeData, NodeStatus } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';

type NodeStatusFilter = 'all' | NodeStatus;

const NODE_STATUS_FILTER_OPTIONS: Array<{
  value: NodeStatusFilter;
  label: string;
}> = [
  { value: 'all', label: '모든 상태' },
  { value: 'unclassified', label: STATUS_LABELS.unclassified },
  { value: 'reviewing', label: STATUS_LABELS.reviewing },
  { value: 'promising', label: STATUS_LABELS.promising },
  { value: 'final', label: STATUS_LABELS.final },
  { value: 'dropped', label: STATUS_LABELS.dropped },
];

function getNodeSearchText(node: NodeData) {
  return [
    getNodeSequenceLabel(node),
    STATUS_LABELS[node.status],
    node.note,
    getNodeDisplayPrompt(node) ?? '',
    node.userIntent ?? '',
    node.modelUsed ?? '',
    node.source,
  ]
    .join(' ')
    .toLowerCase();
}

export function ArchiveSettingsPanel() {
  const nodeProjectId = useNodeStore((state) => state.projectId);
  const directionProjectId = useDirectionStore((state) => state.projectId);
  const projectId = nodeProjectId ?? directionProjectId;

  const [archivedNodes, setArchivedNodes] = useState<NodeData[]>([]);
  const [archivedDirections, setArchivedDirections] = useState<Direction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [nodeStatusFilter, setNodeStatusFilter] =
    useState<NodeStatusFilter>('all');
  const [pendingRestoreKey, setPendingRestoreKey] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const loadArchivedItems = useCallback(async () => {
    if (!projectId) {
      setArchivedNodes([]);
      setArchivedDirections([]);
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [nodes, directions] = await Promise.all([
        fetchJson<NodeData[]>(`/api/projects/${projectId}/nodes?scope=archived`),
        fetchJson<Direction[]>(
          `/api/projects/${projectId}/directions?scope=archived`
        ),
      ]);

      setArchivedNodes(nodes);
      setArchivedDirections(directions);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '보관된 항목을 불러오지 못했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const refreshActiveData = useCallback(async () => {
    if (!projectId) {
      return;
    }

    await Promise.all([
      useNodeStore.getState().loadNodes(projectId),
      useDirectionStore.getState().loadDirections(projectId),
    ]);
  }, [projectId]);

  useEffect(() => {
    void loadArchivedItems();
  }, [loadArchivedItems]);

  const filteredArchivedDirections = useMemo(() => {
    if (!normalizedQuery) {
      return archivedDirections;
    }

    return archivedDirections.filter((direction) =>
      direction.name.toLowerCase().includes(normalizedQuery)
    );
  }, [archivedDirections, normalizedQuery]);

  const filteredArchivedNodes = useMemo(() => {
    return archivedNodes.filter((node) => {
      if (nodeStatusFilter !== 'all' && node.status !== nodeStatusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return getNodeSearchText(node).includes(normalizedQuery);
    });
  }, [archivedNodes, nodeStatusFilter, normalizedQuery]);

  const handleRestoreDirection = useCallback(
    async (directionId: string) => {
      if (!projectId) {
        return;
      }

      const restoreKey = `direction:${directionId}`;
      const feedbackKey = useUIStore.getState().startSaveFeedback({
        entityType: 'direction',
        entityId: directionId,
        action: 'restore',
        message: '보관된 브랜치를 복구하는 중...',
      });

      setPendingRestoreKey(restoreKey);

      try {
        await fetchJson<Direction>(
          `/api/projects/${projectId}/directions/${directionId}/restore`,
          { method: 'POST' }
        );

        useUIStore
          .getState()
          .markSaveFeedbackSuccess(feedbackKey, '브랜치를 복구했습니다.');
        await Promise.all([loadArchivedItems(), refreshActiveData()]);
      } catch (restoreError) {
        useUIStore.getState().markSaveFeedbackError(
          feedbackKey,
          restoreError instanceof Error
            ? restoreError.message
            : '브랜치를 복구하지 못했습니다.'
        );
      } finally {
        setPendingRestoreKey((current) =>
          current === restoreKey ? null : current
        );
      }
    },
    [loadArchivedItems, projectId, refreshActiveData]
  );

  const handleRestoreNode = useCallback(
    async (nodeId: string) => {
      if (!projectId) {
        return;
      }

      const restoreKey = `node:${nodeId}`;
      const feedbackKey = useUIStore.getState().startSaveFeedback({
        entityType: 'node',
        entityId: nodeId,
        action: 'restore',
        message: '보관된 이미지를 복구하는 중...',
      });

      setPendingRestoreKey(restoreKey);

      try {
        await fetchJson<NodeData>(
          `/api/projects/${projectId}/nodes/${nodeId}/restore`,
          { method: 'POST' }
        );

        useUIStore
          .getState()
          .markSaveFeedbackSuccess(feedbackKey, '이미지를 복구했습니다.');
        await Promise.all([loadArchivedItems(), refreshActiveData()]);
      } catch (restoreError) {
        useUIStore.getState().markSaveFeedbackError(
          feedbackKey,
          restoreError instanceof Error
            ? restoreError.message
            : '이미지를 복구하지 못했습니다.'
        );
      } finally {
        setPendingRestoreKey((current) =>
          current === restoreKey ? null : current
        );
      }
    },
    [loadArchivedItems, projectId, refreshActiveData]
  );

  if (!projectId) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        프로젝트를 불러오면 보관함을 확인할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-col gap-2">
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              보관함
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              보관된 브랜치와 이미지를 찾고 바로 복구할 수 있습니다.
            </p>
          </div>
          <button
            className="shrink-0 self-start whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--text-accent)',
            }}
            onClick={() => void loadArchivedItems()}
            disabled={isLoading}
          >
            {isLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div
            className="rounded px-3 py-2"
            style={{ backgroundColor: 'var(--bg-active)' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>보관된 브랜치</div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {archivedDirections.length}개
            </div>
          </div>
          <div
            className="rounded px-3 py-2"
            style={{ backgroundColor: 'var(--bg-active)' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>보관된 이미지</div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {archivedNodes.length}개
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            검색
          </label>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 메모, 프롬프트 검색"
            className="w-full rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            이미지 상태 필터
          </label>
          <select
            value={nodeStatusFilter}
            onChange={(event) =>
              setNodeStatusFilter(event.target.value as NodeStatusFilter)
            }
            className="w-full rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          >
            {NODE_STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mt-3 text-xs" style={{ color: 'var(--status-dropped)' }}>
            {error}
          </p>
        )}
      </section>

      <section
        className="rounded border"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-3 py-2"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <h3
            className="min-w-0 flex-1 text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            보관된 브랜치
          </h3>
          <span
            className="shrink-0 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {filteredArchivedDirections.length} / {archivedDirections.length}
          </span>
        </div>

        <div className="flex flex-col">
          {isLoading ? (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              보관된 브랜치를 불러오는 중입니다.
            </p>
          ) : filteredArchivedDirections.length === 0 ? (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              {archivedDirections.length === 0
                ? '보관된 브랜치가 없습니다.'
                : '검색 조건에 맞는 브랜치가 없습니다.'}
            </p>
          ) : (
            filteredArchivedDirections.map((direction) => {
              const restoreKey = `direction:${direction.id}`;
              const isRestoring = pendingRestoreKey === restoreKey;

              return (
                <div
                  key={direction.id}
                  className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: direction.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {direction.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      복구하면 다시 브랜치 목록에 나타납니다.
                    </p>
                  </div>
                  <button
                    className="shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--text-accent)',
                      opacity: isRestoring ? 0.7 : 1,
                    }}
                    onClick={() => void handleRestoreDirection(direction.id)}
                    disabled={isRestoring}
                  >
                    {isRestoring ? '복구 중...' : '복구'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section
        className="rounded border"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-3 py-2"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="min-w-0 flex-1">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              보관된 이미지
            </h3>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              상위 이미지나 브랜치가 아직 보관 중이면 연결은 복구할 때 비워집니다.
            </p>
          </div>
          <span
            className="shrink-0 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {filteredArchivedNodes.length} / {archivedNodes.length}
          </span>
        </div>

        <div className="flex flex-col">
          {isLoading ? (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              보관된 이미지를 불러오는 중입니다.
            </p>
          ) : filteredArchivedNodes.length === 0 ? (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              {archivedNodes.length === 0
                ? '보관된 이미지가 없습니다.'
                : '검색 조건에 맞는 이미지가 없습니다.'}
            </p>
          ) : (
            filteredArchivedNodes.map((node) => {
              const restoreKey = `node:${node.id}`;
              const isRestoring = pendingRestoreKey === restoreKey;

              return (
                <div
                  key={node.id}
                  className="flex items-start gap-3 border-b px-3 py-3 last:border-b-0"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <div
                    className="mt-0.5 rounded px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-active)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {getNodeSequenceLabel(node)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--bg-active)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {STATUS_LABELS[node.status]}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {new Date(node.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {node.note && (
                      <p
                        className="mt-1 line-clamp-2 text-xs"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {node.note}
                      </p>
                    )}

                    {getNodeDisplayPrompt(node) && (
                      <p
                        className="mt-1 line-clamp-2 text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {getNodeDisplayPrompt(node)}
                      </p>
                    )}
                  </div>
                  <button
                    className="shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--text-accent)',
                      opacity: isRestoring ? 0.7 : 1,
                    }}
                    onClick={() => void handleRestoreNode(node.id)}
                    disabled={isRestoring}
                  >
                    {isRestoring ? '복구 중...' : '복구'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}


