'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/clientApi';
import type {
  ActivityEventCursor,
  ActivityEventData,
  ActivityEventPage,
} from '@/lib/types';
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
  paginate?: boolean;
  fillHeight?: boolean;
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
  paginate = false,
  fillHeight = false,
}: ActivityTimelineProps) {
  const selectNode = useUIStore((state) => state.selectNode);
  const [events, setEvents] = useState<ActivityEventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [nextCursor, setNextCursor] = useState<ActivityEventCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const baseQuery = useMemo(() => {
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

    if (paginate) {
      params.set('paginate', 'true');
    }

    return params.toString();
  }, [directionId, limit, nodeId, paginate, projectId]);

  const buildEventsUrl = useCallback(
    (cursor: ActivityEventCursor | null = null) => {
      if (!projectId || !baseQuery) {
        return null;
      }

      const params = new URLSearchParams(baseQuery);

      if (cursor) {
        params.set('cursorCreatedAt', String(cursor.createdAt));
        params.set('cursorId', cursor.id);
      }

      return `/api/projects/${projectId}/events?${params.toString()}`;
    },
    [baseQuery, projectId]
  );

  const resetTimeline = useCallback(() => {
    setEvents([]);
    setError('');
    setLoadMoreError('');
    setIsLoading(false);
    setIsLoadingMore(false);
    setNextCursor(null);
    setHasMore(false);
  }, []);

  const loadInitialEvents = useCallback(async () => {
    const url = buildEventsUrl();

    if (!url) {
      resetTimeline();
      return;
    }

    setIsLoading(true);
    setError('');
    setLoadMoreError('');
    setNextCursor(null);
    setHasMore(false);

    try {
      if (paginate) {
        const page = await fetchJson<ActivityEventPage>(url);
        setEvents(page.events);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } else {
        const nextEvents = await fetchJson<ActivityEventData[]>(url);
        setEvents(nextEvents);
      }
    } catch (loadError) {
      setEvents([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : '로그를 불러오지 못했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [buildEventsUrl, paginate, resetTimeline]);

  const loadMoreEvents = useCallback(async () => {
    if (!paginate || !nextCursor || isLoadingMore) {
      return;
    }

    const url = buildEventsUrl(nextCursor);
    if (!url) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError('');

    try {
      const page = await fetchJson<ActivityEventPage>(url);
      setEvents((previous) => [...previous, ...page.events]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      setLoadMoreError(
        loadError instanceof Error
          ? loadError.message
          : '이전 로그를 더 불러오지 못했습니다.'
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildEventsUrl, isLoadingMore, nextCursor, paginate]);

  useEffect(() => {
    void loadInitialEvents();
  }, [loadInitialEvents, refreshKey]);

  useEffect(() => {
    if (!paginate || !hasMore || isLoadingMore || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreEvents();
        }
      },
      {
        root: fillHeight ? scrollViewportRef.current : null,
        rootMargin: '120px 0px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fillHeight, hasMore, isLoadingMore, loadMoreEvents, paginate]);

  const showLoadMore =
    paginate && events.length > 0 && (hasMore || isLoadingMore || Boolean(loadMoreError));

  return (
    <section
      className={`rounded border ${compact ? 'p-3' : 'p-0'} ${
        fillHeight ? 'flex h-full min-h-0 flex-col overflow-hidden' : ''
      }`}
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
          onClick={() => void loadInitialEvents()}
          disabled={isLoading}
        >
          {isLoading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      <div
        ref={fillHeight ? scrollViewportRef : undefined}
        className={getTimelineBodyClassName(compact, fillHeight)}
      >
        {isLoading && events.length === 0 ? (
          <p className={getMessageClassName(compact)} style={{ color: 'var(--text-muted)' }}>
            로그를 불러오는 중입니다.
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

        {showLoadMore && (
          <div
            ref={loadMoreRef}
            className={compact ? 'pt-1' : 'border-t px-3 py-2'}
            style={compact ? undefined : { borderColor: 'var(--border-default)' }}
          >
            <button
              className="w-full rounded px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-accent)',
                border: '1px solid var(--border-default)',
              }}
              onClick={() => void loadMoreEvents()}
              disabled={isLoadingMore || !hasMore}
            >
              {loadMoreError
                ? '이전 로그 다시 불러오기'
                : isLoadingMore
                  ? '이전 로그 불러오는 중...'
                  : '이전 로그 더 보기'}
            </button>
            {loadMoreError && (
              <p className="mt-2 text-[10px]" style={{ color: 'var(--status-dropped)' }}>
                {loadMoreError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function getMessageClassName(compact: boolean) {
  return compact ? 'rounded px-2 py-2 text-xs' : 'px-3 py-4 text-xs';
}

function getTimelineBodyClassName(compact: boolean, fillHeight: boolean) {
  const baseClassName = compact ? 'flex flex-col gap-2' : 'flex flex-col';

  if (!fillHeight) {
    return baseClassName;
  }

  return `min-h-0 flex-1 overflow-y-auto ${baseClassName}`;
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
      return '로그';
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
      return '로그';
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

