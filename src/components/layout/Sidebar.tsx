'use client';

import { ChevronDown, ChevronUp, Settings2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { MODELS } from '@/lib/constants';
import {
  getDefaultAspectRatio,
  getGenerationAspectRatios,
  getModelDefinition,
  getSelectableOutputCounts,
} from '@/lib/imageGeneration';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { useDirectionStore } from '@/stores/directionStore';
import { useGenerationSettingsStore } from '@/stores/generationSettingsStore';
import { useNodeStore } from '@/stores/nodeStore';
import { type BranchFilter, type SidebarTab, useUIStore } from '@/stores/uiStore';
import { ArchiveSettingsPanel } from './ArchiveSettingsPanel';
import { DirectionDialog } from './DirectionDialog';
import { StrategySettingsPanel } from './StrategySettingsPanel';

const SIDEBAR_TAB_LABELS: Record<SidebarTab, string> = {
  'image-bridge': '이미지 브릿지',
  branches: '브랜치',
  strategy: '전략',
  activity: '기록',
  archive: '보관함',
};

export function Sidebar() {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const activeSidebarTab = useUIStore((state) => state.activeSidebarTab);
  const branchFilter = useUIStore((state) => state.branchFilter);
  const saveFeedbackByKey = useUIStore((state) => state.saveFeedbackByKey);
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
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

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
  const activeBranchFilterLabel = useMemo(
    () => getBranchFilterLabel(branchFilter, directions),
    [branchFilter, directions]
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
      </div>

      <div
        className="shrink-0 border-t p-3"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <button
          className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: isSettingsPanelOpen
              ? 'var(--bg-active)'
              : 'transparent',
            color: isSettingsPanelOpen
              ? 'var(--text-accent)'
              : 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onClick={() => setIsSettingsPanelOpen((current) => !current)}
          aria-expanded={isSettingsPanelOpen}
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            설정
          </span>
          {isSettingsPanelOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {isSettingsPanelOpen && (
          <div className="mt-3 max-h-[320px] overflow-y-auto pr-1">
            <SettingsPanel
              projectId={projectId}
              nodeCount={nodeCount}
              branchCount={directionList.length}
              activeBranchFilterLabel={activeBranchFilterLabel}
            />
          </div>
        )}
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

function SettingsPanel({
  projectId,
  nodeCount,
  branchCount,
  activeBranchFilterLabel,
}: {
  projectId: string | null;
  nodeCount: number;
  branchCount: number;
  activeBranchFilterLabel: string;
}) {
  const defaultModelId = useGenerationSettingsStore(
    (state) => state.defaultModelId
  );
  const defaultAspectRatio = useGenerationSettingsStore(
    (state) => state.defaultAspectRatio
  );
  const defaultOutputCount = useGenerationSettingsStore(
    (state) => state.defaultOutputCount
  );
  const setDefaultModelId = useGenerationSettingsStore(
    (state) => state.setDefaultModelId
  );
  const setDefaultAspectRatio = useGenerationSettingsStore(
    (state) => state.setDefaultAspectRatio
  );
  const setDefaultOutputCount = useGenerationSettingsStore(
    (state) => state.setDefaultOutputCount
  );
  const resetDefaults = useGenerationSettingsStore((state) => state.resetDefaults);

  const model = useMemo(
    () => getModelDefinition(defaultModelId),
    [defaultModelId]
  );
  const ratioOptions = useMemo(
    () => getGenerationAspectRatios(model, { includeCustom: true }),
    [model]
  );
  const outputOptions = useMemo(() => getSelectableOutputCounts(model), [model]);

  useEffect(() => {
    if (!ratioOptions.includes(defaultAspectRatio)) {
      setDefaultAspectRatio(getDefaultAspectRatio(model, { includeCustom: true }));
    }

    if (!outputOptions.includes(defaultOutputCount)) {
      setDefaultOutputCount(outputOptions.at(-1) ?? 1);
    }
  }, [
    defaultAspectRatio,
    defaultOutputCount,
    model,
    outputOptions,
    ratioOptions,
    setDefaultAspectRatio,
    setDefaultOutputCount,
  ]);

  return (
    <div className="flex flex-col gap-3">
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
          프로젝트 정보
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <InfoTile label="프로젝트" value={projectId ? '연결됨' : '없음'} />
          <InfoTile label="현재 필터" value={activeBranchFilterLabel} />
          <InfoTile label="노드" value={`${nodeCount}개`} />
          <InfoTile label="브랜치" value={`${branchCount}개`} />
        </div>
      </section>

      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              생성 기본값
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              이미지 생성과 변형 만들기에서 먼저 채워지는 기본값입니다.
            </p>
          </div>
          <button
            className="rounded px-2 py-1 text-[10px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-active)',
              color: 'var(--text-accent)',
            }}
            onClick={() => resetDefaults()}
          >
            초기화
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <SettingsField label="기본 모델">
            <select
              value={defaultModelId}
              onChange={(event) => setDefaultModelId(event.target.value)}
              className="w-full rounded px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField label="기본 비율">
            <div className="flex flex-wrap gap-1">
              {ratioOptions.map((ratio) => {
                const selected = defaultAspectRatio === ratio;

                return (
                  <button
                    key={ratio}
                    className="rounded px-2 py-1 text-[11px] transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: selected
                        ? 'var(--accent-primary)'
                        : 'var(--bg-active)',
                      color: selected
                        ? 'var(--text-inverse)'
                        : 'var(--text-secondary)',
                    }}
                    onClick={() => setDefaultAspectRatio(ratio)}
                  >
                    {ratio === 'custom' ? '직접 입력' : ratio}
                  </button>
                );
              })}
            </div>
          </SettingsField>

          <SettingsField label="기본 수량">
            <div className="flex flex-wrap gap-1">
              {outputOptions.map((count) => {
                const selected = defaultOutputCount === count;

                return (
                  <button
                    key={count}
                    className="rounded px-2 py-1 text-[11px] transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: selected
                        ? 'var(--accent-primary)'
                        : 'var(--bg-active)',
                      color: selected
                        ? 'var(--text-inverse)'
                        : 'var(--text-secondary)',
                    }}
                    onClick={() => setDefaultOutputCount(count)}
                  >
                    {count}개
                  </button>
                );
              })}
            </div>
          </SettingsField>
        </div>
      </section>

      <SidebarPlaceholderPanel
        title="연결과 내보내기"
        description="이미지 브릿지와 외부 워크플로 연결 옵션은 이 하단 유틸리티 영역에 이어 붙이는 방향이 자연스럽습니다."
      />
    </div>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded px-3 py-2"
      style={{ backgroundColor: 'var(--bg-active)' }}
    >
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      {children}
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

function getBranchFilterLabel(
  branchFilter: BranchFilter,
  directions: Record<string, { name: string }>
) {
  switch (branchFilter.kind) {
    case 'unclassified':
      return '미분류';
    case 'direction':
      return directions[branchFilter.directionId]?.name ?? '선택 브랜치';
    case 'all':
    default:
      return '전체';
  }
}

