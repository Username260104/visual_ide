'use client';

import { Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  const branchFilter = useUIStore((state) => state.branchFilter);
  const saveFeedbackByKey = useUIStore((state) => state.saveFeedbackByKey);
  const setActiveSidebarTab = useUIStore((state) => state.setActiveSidebarTab);
  const setBranchFilter = useUIStore((state) => state.setBranchFilter);
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

  useEffect(() => {
    if (
      branchFilter.kind === 'direction' &&
      !directions[branchFilter.directionId]
    ) {
      setBranchFilter({ kind: 'all' });
    }
  }, [branchFilter, directions, setBranchFilter]);

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
      className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r"
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
        className="shrink-0 border-b px-3 py-3"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <button
          className="flex w-full items-start gap-3 rounded px-3 py-3 text-left transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
          }}
          onClick={() => setGenerateDialogOpen(true)}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">이미지 생성</span>
            <span className="mt-1 text-[11px]" style={{ opacity: 0.86 }}>
              생성 결과는 먼저 검토함에 올라오고, 확인 후 캔버스에 반영됩니다.
            </span>
          </span>
        </button>
      </div>

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeSidebarTab === 'image-bridge' && (
          <div className="flex flex-col gap-3 p-3">
            <SidebarPlaceholderPanel
              title="이미지 브릿지"
              description="들여오기와 내보내기 기능은 다음 단계에서 다룹니다. 지금은 작업 흐름에서 자리를 먼저 확보해 둡니다."
            />
          </div>
        )}

        {activeSidebarTab === 'branches' && (
          <div className="flex flex-col gap-2 p-3">
            <BranchFilterRow
              label="전체"
              count={nodeCount}
              active={branchFilter.kind === 'all'}
              onClick={() => setBranchFilter({ kind: 'all' })}
            />

            <BranchFilterRow
              label="미분류"
              count={unclassifiedCount}
              active={branchFilter.kind === 'unclassified'}
              dotColor="var(--status-unclassified)"
              onClick={() => setBranchFilter({ kind: 'unclassified' })}
            />

            {directionList.map((direction) => {
              const count = directionCounts[direction.id] ?? 0;
              const isDeleting = pendingDirectionId === direction.id;

              return (
                <div key={direction.id} className="group flex items-center gap-2">
                  <BranchFilterRow
                    label={direction.name}
                    count={count}
                    active={
                      branchFilter.kind === 'direction' &&
                      branchFilter.directionId === direction.id
                    }
                    dotColor={direction.color}
                    onClick={() =>
                      setBranchFilter({
                        kind: 'direction',
                        directionId: direction.id,
                      })
                    }
                  />
                  <button
                    className="shrink-0 rounded px-1.5 py-1 text-xs transition-opacity group-hover:opacity-100"
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
            <SettingsPanel />
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t p-3"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <button
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor:
              activeSidebarTab === 'settings'
                ? 'var(--bg-active)'
                : 'transparent',
            color:
              activeSidebarTab === 'settings'
                ? 'var(--text-accent)'
                : 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onClick={() => setActiveSidebarTab('settings')}
        >
          <Settings2 className="h-3.5 w-3.5" />
          설정
        </button>
      </div>

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

function BranchFilterRow({
  label,
  count,
  active,
  onClick,
  dotColor,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  dotColor?: string;
}) {
  return (
    <button
      className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-sm text-left transition-colors hover:opacity-90"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--sidebar-fg)',
        backgroundColor: active ? 'var(--bg-active)' : 'transparent',
        border: active
          ? '1px solid var(--border-default)'
          : '1px solid transparent',
      }}
      onClick={onClick}
    >
      {dotColor ? (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      ) : (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: active
              ? 'var(--text-accent)'
              : 'var(--text-muted)',
          }}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {count}
      </span>
    </button>
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

function SettingsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <SidebarPlaceholderPanel
        title="설정"
        description="설정은 작업 탭이 아니라 도구 기본값을 다루는 유틸리티 영역으로 분리합니다."
      />

      <SidebarPlaceholderPanel
        title="프로젝트 정보"
        description="프로젝트 이름, 설명, 대표 썸네일 같은 메타 정보는 여기에서 다루는 방향이 적절합니다."
      />

      <SidebarPlaceholderPanel
        title="생성 기본값"
        description="기본 모델, 비율, 생성 수량처럼 반복 작업에 영향을 주는 기본값을 다음 단계에서 연결합니다."
      />

      <SidebarPlaceholderPanel
        title="연결과 내보내기"
        description="이미지 브릿지와 외부 워크플로 연결 옵션은 이 영역과 자연스럽게 이어지도록 정리합니다."
      />
    </div>
  );
}

