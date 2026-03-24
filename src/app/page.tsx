'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';

export default function ProjectListPage() {
  const { projects, isLoading, loadProjects } = useProjectStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between h-14 px-6 shrink-0 border-b"
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
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Visual IDE for AI Images
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            프로젝트
          </h2>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onClick={() => setIsCreateOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 프로젝트
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--border-default)',
                borderTopColor: 'var(--accent-primary)',
              }}
            />
          </div>
        ) : projects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg
              className="w-16 h-16 mb-4 opacity-30"
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
            <p className="text-sm mb-2">프로젝트가 없습니다</p>
            <p className="text-xs mb-4">새 프로젝트를 만들어 AI 이미지 작업을 시작하세요.</p>
            <button
              className="px-4 py-2 rounded text-sm font-semibold"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* New project card */}
            <div
              className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.02] min-h-[200px]"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-muted)',
              }}
              onClick={() => setIsCreateOpen(true)}
            >
              <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">새 프로젝트</span>
            </div>

            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
