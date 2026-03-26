'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { SidebarTab, useUIStore } from '@/stores/uiStore';
import { ArchiveSettingsPanel } from './ArchiveSettingsPanel';
import { DirectionDialog } from './DirectionDialog';
import { StrategySettingsPanel } from './StrategySettingsPanel';

const SIDEBAR_TAB_LABELS: Record<SidebarTab, string> = {
  'image-generation': '이미지 생성',
  'image-bridge': '이미지 브릿지',
  branches: '브랜치',
  strategy: '전략',
  activity: '기록',
  archive: '보관함',
  settings: '설정',
};

export function Sidebar() {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const activeSidebarTab = useUIStore((state) => state.activeSidebarTab);
  const saveFeedbackByKey = useUIStore((state) => state.saveFeedbackByKey);
  const setDirectionDialogOpen = useUIStore(
    (state) => state.setDirectionDialogOpen
  );
  const setGenerateDialogOpen = useUIStore(
    (state) => state.setGenerateDialogOpen
  );
  const nodes = useNodeStore((state) => state.nodes);
  const nodeProjectId = useNodeStore((state) => state.projectId);
  const clearDirectionAssignments = useNodeStore(
    (state) => state.clearDirectionAssignments
  );
  const directions = useDirectionStore((state) => state.directions);
  const directionProjectId = useDirectionStore((state) => state.projectId);
  const deleteDirection = useDirectionStore((state) => state.deleteDirection);

  const [pendingDirectionId, setPendingDirectionId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const directionList = useMemo(() => Object.values(directions), [directions]);
  const projectId = nodeProjectId ?? directionProjectId;
  const activityRefreshKey = useMemo(
    () =>
      Object.values(saveFeedbackByKey)
        .map((entry) => `${entry.key}:${entry.status}:${entry.updatedAt}`)
        .join('|'),
    [saveFeedbackByKey]
  );
  const directionCounts = useMemo(
    () =>
      nodeList.reduce<Record<string, number>>((counts, node) => {
        const key = node.directionId ?? '__unclassified__';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    [nodeList]
  );

  const nodeCount = nodeList.length;
  const unclassifiedCount = directionCounts.__unclassified__ ?? 0;
  const deleteTargetDirection = deleteTargetId ? directions[deleteTargetId] : null;

  if (!isSidebarOpen) {
    return null;
  }

  const handleDeleteDirection = async (directionId: string) => {
    if (pendingDirectionId) {
      return;
    }

    setPendingDirectionId(directionId);

    try {
      const deleted = await deleteDirection(directionId);
      if (deleted) {
        clearDirectionAssignments(directionId);
        setDeleteTargetId(null);
      }
    } finally {
      setPendingDirectionId(null);
    }
  };

  return (
    <div
      className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--border-default)',
      }}
    >
      <Link
        href="/"
        className="flex h-8 shrink-0 items-center gap-2 px-4 text-[11px] transition-opacity hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-accent)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        프로젝트 목록
      </Link>

      <div
        className="flex h-9 shrink-0 items-center justify-between px-4 text-xs font-semibold uppercase tracking-wider"
        style={{
          backgroundColor: 'var(--sidebar-header-bg)',
          color: 'var(--sidebar-header-fg)',
        }}
      >
        <span>{SIDEBAR_TAB_LABELS[activeSidebarTab]}</span>
        {activeSidebarTab === 'branches' && (
          <button
            className="text-base leading-none transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-accent)' }}
            onClick={() => setDirectionDialogOpen(true)}
            title="브랜치 추가"
          >
            +
          </button>
        )}
      </div>

      {activeSidebarTab === 'image-generation' && (
        <div className="flex flex-col gap-3 p-3">
          <section
            className="rounded border p-3"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              이미지 생성
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              생성 결과는 캔버스에 바로 추가되지 않고 staging tray에 먼저 쌓입니다.
            </p>
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
              }}
              onClick={() => setGenerateDialogOpen(true)}
              title="AI로 이미지를 생성"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              이미지 생성
            </button>
          </section>
        </div>
      )}

      {activeSidebarTab === 'image-bridge' && (
        <div className="flex flex-col gap-3 p-3">
          <SidebarPlaceholderPanel
            title="이미지 브릿지"
            description="들여오기와 내보내기 기능이 들어올 자리입니다. 이번 단계에서는 탭 구조만 먼저 확보합니다."
          />
        </div>
      )}

      {activeSidebarTab === 'branches' && (
        <div className="flex flex-col gap-2 p-3">
          <div
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: 'var(--status-unclassified)' }}
            />
            <span className="flex-1">미분류</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {unclassifiedCount}
            </span>
          </div>

          {directionList.map((direction) => {
            const count = directionCounts[direction.id] ?? 0;
            const isDeleting = pendingDirectionId === direction.id;

            return (
              <div
                key={direction.id}
                className="group flex items-center gap-2 rounded px-2 py-1.5 text-sm"
                style={{ color: 'var(--sidebar-fg)' }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: direction.color }}
                />
                <span className="flex-1 truncate">{direction.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {count}
                </span>
                <button
                  className="ml-1 text-xs transition-opacity group-hover:opacity-100"
                  style={{
                    color: isDeleting
                      ? 'var(--text-accent)'
                      : 'var(--text-muted)',
                    opacity: isDeleting ? 1 : 0,
                  }}
                  onClick={() => setDeleteTargetId(direction.id)}
                  title={isDeleting ? '보관 중...' : '보관'}
                  disabled={Boolean(pendingDirectionId)}
                >
                  {isDeleting ? '...' : 'x'}
                </button>
              </div>
            );
          })}

          {directionList.length === 0 && nodeCount === 0 && (
            <p
              className="px-2 py-4 text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              브랜치를 만들거나 이미지 생성부터 시작해 보세요.
            </p>
          )}
        </div>
      )}

      {activeSidebarTab === 'strategy' && (
        <div className="p-3">
          <StrategySettingsPanel />
        </div>
      )}

      {activeSidebarTab === 'activity' && (
        <div className="p-3">
          <ActivityTimeline
            projectId={projectId}
            limit={12}
            title="최근 기록"
            emptyMessage="프로젝트 기록이 아직 없습니다."
            refreshKey={activityRefreshKey}
          />
        </div>
      )}

      {activeSidebarTab === 'archive' && <ArchiveSettingsPanel />}

      {activeSidebarTab === 'settings' && (
        <div className="flex flex-col gap-3 p-3">
          <SidebarPlaceholderPanel
            title="설정"
            description="프로젝트 메타 정보, 연결 설정, 운영성 옵션이 들어올 자리입니다. 이번 단계에서는 탭 구조만 분리합니다."
          />
        </div>
      )}

      <DirectionDialog />
      <DestructiveActionDialog
        isOpen={Boolean(deleteTargetDirection)}
        title="브랜치를 보관할까요?"
        description={
          deleteTargetDirection
            ? `'${deleteTargetDirection.name}' 브랜치를 보관합니다.`
            : ''
        }
        confirmLabel="브랜치 보관"
        impacts={
          deleteTargetDirection
            ? [
                `연결된 노드 ${directionCounts[deleteTargetDirection.id] ?? 0}개`,
                `브랜치 이름 '${deleteTargetDirection.name}'`,
              ]
            : []
        }
        consequences={
          deleteTargetDirection
            ? [
                '연결된 노드는 모두 미분류로 이동합니다.',
                '이 브랜치는 목록에서 사라지고 보관함에서 복구할 수 있습니다.',
              ]
            : []
        }
        isSubmitting={Boolean(
          deleteTargetDirection && pendingDirectionId === deleteTargetDirection.id
        )}
        onClose={() => {
          if (!pendingDirectionId) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() =>
          deleteTargetDirection
            ? handleDeleteDirection(deleteTargetDirection.id)
            : undefined
        }
      />
    </div>
  );
}

function SidebarPlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      className="rounded border p-3"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    </section>
  );
}
