'use client';

import { Project } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?\n모든 노드와 방향이 삭제됩니다.`)) {
      deleteProject(project.id);
    }
  };

  return (
    <div
      className="group rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}
      onClick={() => router.push(`/project/${project.id}`)}
    >
      {/* Thumbnail area */}
      <div
        className="w-full h-32 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-active)' }}
      >
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-10 h-10 opacity-30"
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
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <div className="flex items-start justify-between">
          <h3
            className="text-sm font-semibold truncate flex-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {project.name}
          </h3>
          <button
            className="opacity-0 group-hover:opacity-100 text-xs ml-2 px-1.5 py-0.5 rounded transition-opacity hover:bg-red-500/20"
            style={{ color: 'var(--status-dropped)' }}
            onClick={handleDelete}
            title="프로젝트 삭제"
          >
            ×
          </button>
        </div>
        {project.description && (
          <p
            className="text-xs truncate"
            style={{ color: 'var(--text-muted)' }}
          >
            {project.description}
          </p>
        )}
        <div className="flex gap-3 mt-1">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            노드 {project.nodeCount ?? 0}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            방향 {project.directionCount ?? 0}
          </span>
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(project.updatedAt).toLocaleDateString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
