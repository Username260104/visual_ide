'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { Project } from '@/lib/types';
import { useProjectStore } from '@/stores/projectStore';

interface ProjectCardProps {
  project: Project;
  mode?: 'active' | 'archived';
}

export function ProjectCard({
  project,
  mode = 'active',
}: ProjectCardProps) {
  const router = useRouter();
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const restoreProject = useProjectStore((state) => state.restoreProject);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState('');

  const isArchived = mode === 'archived';

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await deleteProject(project.id);
      setIsDeleteDialogOpen(false);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : '프로젝트를 삭제하지 못했습니다'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (isRestoring) {
      return;
    }

    setIsRestoring(true);
    setError('');

    try {
      const restoredProject = await restoreProject(project.id);
      router.push(`/project/${restoredProject.id}`);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : '프로젝트를 복구하지 못했습니다'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div
        className={`group overflow-hidden rounded-lg transition-all ${
          isArchived
            ? 'cursor-default opacity-80'
            : 'cursor-pointer hover:scale-[1.02]'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
        }}
        onClick={() => {
          if (!isArchived) {
            router.push(`/project/${project.id}`);
          }
        }}
      >
        <div
          className="relative flex h-32 w-full items-center justify-center"
          style={{ backgroundColor: 'var(--bg-active)' }}
        >
          {project.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              className="h-10 w-10 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--text-muted)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}

          {isArchived && (
            <span
              className="absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-semibold"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.62)',
                color: 'var(--text-inverse)',
              }}
            >
              보관됨
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="flex-1 truncate text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {project.name}
            </h3>

            {isArchived ? (
              <button
                className="rounded px-2 py-1 text-[11px] font-semibold"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-accent)',
                  opacity: isRestoring ? 0.6 : 1,
                }}
                onClick={(event) => void handleRestore(event)}
                disabled={isRestoring}
                title="프로젝트 복구"
              >
                {isRestoring ? '복구 중...' : '복구'}
              </button>
            ) : (
              <button
                className="rounded px-1.5 py-0.5 text-xs opacity-0 transition-opacity hover:bg-red-500/20 group-hover:opacity-100"
                style={{ color: 'var(--status-dropped)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  setError('');
                  setIsDeleteDialogOpen(true);
                }}
                title="프로젝트 삭제"
              >
                x
              </button>
            )}
          </div>

          {project.description && (
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {project.description}
            </p>
          )}

          <div className="mt-1 flex gap-3">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              노드 {project.nodeCount ?? 0}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              브랜치 {project.directionCount ?? 0}
            </span>
          </div>

          <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(project.updatedAt).toLocaleDateString('ko-KR')}
          </div>

          {isArchived && error && (
            <p className="text-[10px]" style={{ color: 'var(--status-dropped)' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {!isArchived && (
        <DestructiveActionDialog
          isOpen={isDeleteDialogOpen}
          title="프로젝트를 삭제할까요?"
          description={`'${project.name}' 프로젝트를 보관합니다.`}
          confirmLabel="프로젝트 보관"
          impacts={[
            `노드 ${project.nodeCount ?? 0}개`,
            `브랜치 ${project.directionCount ?? 0}개`,
          ]}
          consequences={[
            '프로젝트 목록의 기본 화면에서는 숨겨집니다',
            '보관된 프로젝트 목록에서 다시 복구할 수 있습니다',
          ]}
          isSubmitting={isDeleting}
          error={error}
          onClose={() => {
            if (!isDeleting) {
              setError('');
              setIsDeleteDialogOpen(false);
            }
          }}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

