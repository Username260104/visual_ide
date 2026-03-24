'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';
import { DirectionDialog } from './DirectionDialog';

export function Sidebar() {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const activeSidebarTab = useUIStore((state) => state.activeSidebarTab);
  const setDirectionDialogOpen = useUIStore(
    (state) => state.setDirectionDialogOpen
  );
  const setGenerateDialogOpen = useUIStore(
    (state) => state.setGenerateDialogOpen
  );
  const nodes = useNodeStore((state) => state.nodes);
  const updateNode = useNodeStore((state) => state.updateNode);
  const directions = useDirectionStore((state) => state.directions);
  const deleteDirection = useDirectionStore((state) => state.deleteDirection);

  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const directionList = useMemo(() => Object.values(directions), [directions]);
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

  const handleDeleteDirection = (directionId: string) => {
    nodeList
      .filter((node) => node.directionId === directionId)
      .forEach((node) => updateNode(node.id, { directionId: null }));
    deleteDirection(directionId);
  };

  if (!isSidebarOpen) return null;

  return (
    <div
      className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r"
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
        <span>{activeSidebarTab === 'directions' ? 'Directions' : 'Settings'}</span>
        {activeSidebarTab === 'directions' && (
          <button
            className="text-base leading-none transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-accent)' }}
            onClick={() => setDirectionDialogOpen(true)}
            title="Direction 추가"
          >
            +
          </button>
        )}
      </div>

      {activeSidebarTab === 'directions' ? (
        <div className="flex flex-col gap-2 p-3">
          <button
            className="flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onClick={() => setGenerateDialogOpen(true)}
            title="AI로 첫 이미지를 생성"
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
            초기 이미지 생성
          </button>

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
                  className="ml-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleDeleteDirection(direction.id)}
                  title="삭제"
                >
                  x
                </button>
              </div>
            );
          })}

          {directionList.length === 0 && nodeCount === 0 && (
            <p
              className="px-2 py-4 text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              이미지를 드래그하거나 AI 생성으로 작업을 시작해 보세요.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <p className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            프로젝트 설정 영역은 다음 단계에서 확장할 예정입니다.
          </p>
        </div>
      )}

      <DirectionDialog />
    </div>
  );
}
