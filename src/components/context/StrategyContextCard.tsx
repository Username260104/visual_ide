'use client';

import { useMemo, useState } from 'react';

export interface StrategyContextItem {
  label: string;
  value: string | null | undefined;
}

interface StrategyContextCardProps {
  title: string;
  subtitle?: string;
  items: StrategyContextItem[];
  emptyMessage?: string;
  isLoading?: boolean;
  error?: string | null;
}

const COLLAPSED_VISIBLE_COUNT = 2;
const LONG_TEXT_THRESHOLD = 140;

export function StrategyContextCard({
  title,
  subtitle,
  items,
  emptyMessage = '아직 입력된 전략 정보가 없습니다.',
  isLoading = false,
  error = null,
}: StrategyContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = useMemo(
    () => items.filter((item) => item.value && item.value.trim().length > 0),
    [items]
  );

  const shouldCollapse =
    visibleItems.length > COLLAPSED_VISIBLE_COUNT ||
    visibleItems.some((item) => (item.value?.length ?? 0) > LONG_TEXT_THRESHOLD);
  const renderedItems =
    shouldCollapse && !isExpanded
      ? visibleItems.slice(0, COLLAPSED_VISIBLE_COUNT)
      : visibleItems;

  return (
    <section
      className="rounded border px-3 py-3"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h4>
          {subtitle && (
            <p
              className="mt-1 text-[11px] leading-5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {shouldCollapse && (
          <button
            type="button"
            className="shrink-0 text-[11px] transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-accent)' }}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? '접기' : '더 보기'}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          전략 정보를 불러오는 중입니다.
        </p>
      ) : error ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--status-dropped)' }}>
          {error}
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {renderedItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {item.label}
              </span>
              <p
                className={`text-xs leading-5 ${
                  shouldCollapse && !isExpanded ? 'line-clamp-3' : ''
                }`}
                style={{ color: 'var(--text-primary)' }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
