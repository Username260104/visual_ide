'use client';

import { NodeGraph } from '@/components/graph/NodeGraph';
import { IDELayout } from '@/components/layout/IDELayout';
import { useProjectLoader } from '@/hooks/useProjectLoader';

export default function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const { isReady, isLoading, error, reload } = useProjectLoader(id);

  if (isLoading || !isReady) {
    if (error) {
      return (
        <FullscreenState
          title="프로젝트를 불러오지 못했습니다."
          description={error}
          actionLabel="다시 시도"
          onAction={reload}
        />
      );
    }

    return (
      <FullscreenState
        title="프로젝트를 불러오는 중입니다."
        description="노드와 방향 데이터를 준비하고 있습니다."
        loading
      />
    );
  }

  return (
    <IDELayout>
      <NodeGraph />
    </IDELayout>
  );
}

function FullscreenState({
  title,
  description,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="max-w-sm text-center">
        {loading && (
          <div
            className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2"
            style={{
              borderColor: 'var(--border-default)',
              borderTopColor: 'var(--accent-primary)',
            }}
          />
        )}

        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </p>
        <p className="mt-2 text-xs">{description}</p>

        {actionLabel && onAction && (
          <button
            className="mt-4 rounded px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
