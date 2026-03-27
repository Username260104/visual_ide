'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/clientApi';
import type { ActivityEventData } from '@/lib/types';
import { useUIStore } from '@/stores/uiStore';

interface ActivityTimelineProps {
  projectId: string | null;
  title: string;
  emptyMessage: string;
  limit?: number;
  nodeId?: string | null;
  directionId?: string | null;
  refreshKey?: string;
  compact?: boolean;
}

export function ActivityTimeline({
  projectId,
  title,
  emptyMessage,
  limit = 8,
  nodeId = null,
  directionId = null,
  refreshKey = '',
  compact = false,
}: ActivityTimelineProps) {
  const selectNode = useUIStore((state) => state.selectNode);
  const [events, setEvents] = useState<ActivityEventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const eventsUrl = useMemo(() => {
    if (!projectId) {
      return null;
    }

    const params = new URLSearchParams();
    params.set('limit', String(limit));

    if (nodeId) {
      params.set('nodeId', nodeId);
    }

    if (directionId) {
      params.set('directionId', directionId);
    }

    return `/api/projects/${projectId}/events?${params.toString()}`;
  }, [directionId, limit, nodeId, projectId]);

  const loadEvents = useCallback(async () => {
    if (!eventsUrl) {
      setEvents([]);
      setError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextEvents = await fetchJson<ActivityEventData[]>(eventsUrl);
      setEvents(nextEvents);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '활동 기록을 불러오지 못했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventsUrl]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, refreshKey]);

  return (
    <section
      className={`rounded border ${compact ? 'p-3' : 'p-0'}`}
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div
        className={`flex items-center justify-between ${compact ? 'pb-2' : 'border-b px-3 py-2'}`}
        style={compact ? undefined : { borderColor: 'var(--border-default)' }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>
        <button
          className="text-[11px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-accent)' }}
          onClick={() => void loadEvents()}
          disabled={isLoading}
        >
          {isLoading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col'}>
        {isLoading && events.length === 0 ? (
          <p className={getMessageClassName(compact)} style={{ color: 'var(--text-muted)' }}>
            활동 기록을 불러오는 중입니다.
          </p>
        ) : error ? (
          <p className={getMessageClassName(compact)} style={{ color: 'var(--status-dropped)' }}>
            {error}
          </p>
        ) : events.length === 0 ? (
          <p className={getMessageClassName(compact)} style={{ color: 'var(--text-muted)' }}>
            {emptyMessage}
          </p>
        ) : (
          events.map((event, index) => {
            const isInteractive = Boolean(event.nodeId);

            return (
              <button
                key={event.id}
                className={`w-full text-left ${compact ? 'rounded px-2 py-2' : 'border-b px-3 py-2 last:border-b-0'}`}
                style={{
                  backgroundColor: compact ? 'var(--bg-active)' : 'transparent',
                  borderColor:
                    !compact && index !== events.length - 1
                      ? 'var(--border-default)'
                      : undefined,
                  cursor: isInteractive ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (event.nodeId) {
                    selectNode(event.nodeId);
                  }
                }}
                disabled={!isInteractive}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={getKindBadgeStyle(event.kind)}
                  >
                    {getEventKindLabel(event.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {getEventSummary(event)}
                    </div>
                    <div
                      className="mt-1 flex flex-wrap items-center gap-2 text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{formatEventTimestamp(event.createdAt)}</span>
                      {event.actorLabel && <span>{event.actorLabel}</span>}
                      {!event.actorLabel && event.actorType && (
                        <span>{getActorLabel(event.actorType)}</span>
                      )}
                      {event.nodeId && !nodeId && <span>이미지 연결됨</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function getMessageClassName(compact: boolean) {
  return compact ? 'rounded px-2 py-2 text-xs' : 'px-3 py-4 text-xs';
}

function formatEventTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return '방금 전';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getActorLabel(actorType: ActivityEventData['actorType']) {
  switch (actorType) {
    case 'system':
      return '시스템';
    case 'designer':
      return '디자이너';
    case 'director':
      return '디렉터';
    case 'client':
      return '클라이언트';
    default:
      return '기록';
  }
}

function getEventKindLabel(kind: ActivityEventData['kind']) {
  switch (kind) {
    case 'node-created':
      return '생성';
    case 'node-reparented':
      return '계보';
    case 'node-status-changed':
      return '상태';
    case 'node-direction-changed':
      return '브랜치';
    case 'node-note-saved':
      return '메모';
    case 'node-archived':
      return '보관';
    case 'node-restored':
      return '복구';
    case 'direction-archived':
      return '브랜치 보관';
    case 'direction-restored':
      return '브랜치 복구';
    case 'project-archived':
      return '프로젝트 보관';
    case 'project-restored':
      return '프로젝트 복구';
    case 'feedback-recorded':
      return '피드백';
    case 'decision-recorded':
      return '결정';
    case 'comparison-recorded':
      return '비교';
    case 'prompt-diff-summarized':
      return '프롬프트';
    case 'brief-updated':
      return '브리프';
    case 'direction-thesis-updated':
      return '브랜치 전략';
    default:
      return '기록';
  }
}

function getEventSummary(event: ActivityEventData) {
  if (event.kind === 'comparison-recorded') {
    return getComparisonSummary(event);
  }

  return event.summary ?? getEventKindLabel(event.kind);
}

function getComparisonSummary(event: ActivityEventData) {
  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : null;

  const sourceLabel =
    payload?.sourceKind === 'variation-panel' ? '변형 후보' : '생성 후보';
  const acceptedCount =
    getArrayLength(payload?.acceptedCandidateIds) ??
    getArrayLength(payload?.acceptedNodes) ??
    getArrayLength(payload?.acceptedNodeIds) ??
    0;
  const rejectedCount = getArrayLength(payload?.rejectedCandidateIds) ?? 0;

  return `${sourceLabel} ${acceptedCount}개 채택, ${rejectedCount}개 기각`;
}

function getArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : null;
}

function getKindBadgeStyle(kind: ActivityEventData['kind']) {
  switch (kind) {
    case 'node-created':
    case 'node-restored':
    case 'direction-restored':
    case 'project-restored':
      return {
        backgroundColor: 'var(--status-final)',
        color: 'var(--text-inverse)',
      };
    case 'node-archived':
    case 'direction-archived':
    case 'project-archived':
      return {
        backgroundColor: 'var(--status-dropped)',
        color: 'var(--text-inverse)',
      };
    case 'node-status-changed':
    case 'node-direction-changed':
    case 'node-note-saved':
    case 'node-reparented':
    case 'feedback-recorded':
      return {
        backgroundColor: 'var(--accent-subtle)',
        color: 'var(--text-accent)',
      };
    case 'decision-recorded':
      return {
        backgroundColor: 'var(--accent-primary)',
        color: 'var(--text-inverse)',
      };
    default:
      return {
        backgroundColor: 'var(--bg-active)',
        color: 'var(--text-secondary)',
      };
  }
}
