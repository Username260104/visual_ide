'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { useProjectStore } from '@/stores/projectStore';

export default function ProjectListPage() {
  const projects = useProjectStore((state) => state.projects);
  const archivedProjects = useProjectStore((state) => state.archivedProjects);
  const isLoading = useProjectStore((state) => state.isLoading);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const deferredArchiveQuery = useDeferredValue(archiveQuery);

  useEffect(() => {
    void useProjectStore.getState().loadProjects();
  }, []);

  const hasProjects = projects.length > 0;
  const hasArchivedProjects = archivedProjects.length > 0;
  const normalizedArchiveQuery = deferredArchiveQuery.trim().toLowerCase();

  const filteredArchivedProjects = useMemo(() => {
    if (!normalizedArchiveQuery) {
      return archivedProjects;
    }

    return archivedProjects.filter((project) => {
      const haystack = `${project.name} ${project.description}`.toLowerCase();
      return haystack.includes(normalizedArchiveQuery);
    });
  }, [archivedProjects, normalizedArchiveQuery]);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <header
        className="flex h-14 shrink-0 items-center justify-between border-b px-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-base font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            VIDE
          </h1>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Visual IDE for AI Images
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            프로젝트
          </h2>
          <button
            className="flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onClick={() => setIsCreateOpen(true)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            새 프로젝트
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{
                borderColor: 'var(--border-default)',
                borderTopColor: 'var(--accent-primary)',
              }}
            />
          </div>
        ) : !hasProjects ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg
              className="mb-4 h-16 w-16 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="mb-2 text-sm">생성된 프로젝트가 없습니다.</p>
            <p className="mb-4 text-xs">
              새 프로젝트를 만들고 AI 이미지 작업을 시작해 보세요.
            </p>
            <button
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
              }}
              onClick={() => setIsCreateOpen(true)}
            >
              첫 프로젝트 만들기
            </button>
          </div>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <div
                className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all hover:scale-[1.02]"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-muted)',
                }}
                onClick={() => setIsCreateOpen(true)}
              >
                <svg
                  className="mb-2 h-8 w-8 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-xs">새 프로젝트</span>
              </div>

              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        {hasArchivedProjects && (
          <section className="flex flex-col gap-3">
            <button
              className="flex items-center justify-between rounded border px-4 py-3 text-left"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
              onClick={() => setIsArchiveOpen((open) => !open)}
            >
              <span className="text-sm font-semibold">
                보관된 프로젝트 {archivedProjects.length}개
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {isArchiveOpen ? '접기' : '펼치기'}
              </span>
            </button>

            {isArchiveOpen && (
              <div className="flex flex-col gap-4">
                <div
                  className="flex flex-col gap-2 rounded border p-4"
                  style={{
                    borderColor: 'var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    보관함 검색
                  </label>
                  <input
                    type="text"
                    value={archiveQuery}
                    onChange={(event) => setArchiveQuery(event.target.value)}
                    placeholder="프로젝트 이름 또는 설명으로 찾기"
                    className="w-full rounded px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                    }}
                  />
                  <p
                    className="text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    현재 {filteredArchivedProjects.length}개가 검색되었습니다.
                  </p>
                </div>

                {filteredArchivedProjects.length === 0 ? (
                  <div
                    className="rounded border px-4 py-6 text-sm"
                    style={{
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {filteredArchivedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        mode="archived"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
