'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModalShell } from '@/components/ui/ModalShell';
import { useProjectStore } from '@/stores/projectStore';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createProject = useProjectStore((state) => state.createProject);
  const router = useRouter();

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onClose();
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    setError('');

    try {
      const project = await createProject(trimmedName, description.trim());
      resetForm();
      onClose();
      router.push(`/project/${project.id}`);
    } catch (createError) {
      console.error('Failed to create project:', createError);
      setError(
        createError instanceof Error
          ? createError.message
          : '프로젝트를 생성하지 못했습니다.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ModalShell
      onClose={handleClose}
      closeDisabled={isCreating}
      backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      panelClassName="w-[400px] p-5"
      panelStyle={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)' }}
    >
      <div className="flex flex-col gap-4">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          새 프로젝트 만들기
        </h2>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            프로젝트 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError('');
            }}
            placeholder="예: Luna 캠페인 비주얼"
            className="w-full rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleCreate();
              }
            }}
            disabled={isCreating}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            설명
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="프로젝트 목적이나 방향을 간단히 적어 주세요."
            rows={2}
            className="w-full resize-none rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
            disabled={isCreating}
          />
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="rounded px-4 py-2 text-sm"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
            onClick={handleClose}
            disabled={isCreating}
          >
            취소
          </button>
          <button
            className="rounded px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: isCreating
                ? 'var(--bg-active)'
                : 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              opacity: !name.trim() || isCreating ? 0.5 : 1,
            }}
            onClick={() => void handleCreate()}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? '생성 중...' : '만들기'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
