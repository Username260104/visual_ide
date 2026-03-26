'use client';

import type { StagingBatch } from '@/lib/types';

interface StagingBatchPreviewProps {
  batch: StagingBatch;
  title?: string;
}

export function StagingBatchPreview({
  batch,
  title = '최근 staging 결과',
}: StagingBatchPreviewProps) {
  const visibleCandidates = batch.candidates.filter(
    (candidate) => candidate.status === 'staged'
  );
  const discardedCount = batch.candidates.filter(
    (candidate) => candidate.status === 'discarded'
  ).length;
  const summary = batch.userIntent ?? batch.resolvedPrompt ?? null;

  if (visibleCandidates.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3"
      style={{
        backgroundColor: 'var(--bg-active)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-primary)' }}>
            {visibleCandidates.length}개의 결과가 staging에 보관되어 있습니다.
            {discardedCount > 0 && ` / 버린 후보 ${discardedCount}개`}
          </div>
        </div>
        <span
          className="rounded px-2 py-1 text-[10px] font-semibold"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--text-accent)',
          }}
        >
          캔버스 미반영
        </span>
      </div>

      {summary && (
        <p className="line-clamp-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {summary}
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {visibleCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="overflow-hidden rounded border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={candidate.imageUrl}
              alt={`staged candidate ${candidate.index + 1}`}
              className="aspect-square h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        선택과 버리기는 하단 staging tray에서 이어서 정리할 수 있습니다.
      </p>
    </div>
  );
}
