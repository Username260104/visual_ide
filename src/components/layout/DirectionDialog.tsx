'use client';

import { useState } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { DIRECTION_COLOR_PRESETS } from '@/lib/constants';
import { useDirectionStore } from '@/stores/directionStore';
import { useUIStore } from '@/stores/uiStore';

export function DirectionDialog() {
  const isOpen = useUIStore((state) => state.isDirectionDialogOpen);
  const setOpen = useUIStore((state) => state.setDirectionDialogOpen);
  const addDirection = useDirectionStore((state) => state.addDirection);

  const [name, setName] = useState('');
  const [color, setColor] = useState(DIRECTION_COLOR_PRESETS[0]);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setColor(DIRECTION_COLOR_PRESETS[0]);
    setError('');
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      setOpen(false);
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    setError('');

    try {
      await addDirection(trimmedName, color);
      resetForm();
      setOpen(false);
    } catch (createError) {
      console.error('Failed to create direction:', createError);
      setError(
        createError instanceof Error
          ? createError.message
          : '브랜치를 만들지 못했습니다.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ModalShell
      onClose={handleClose}
      closeDisabled={isCreating}
      panelClassName="w-[300px] p-4"
    >
      <div className="flex flex-col gap-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          새 브랜치 만들기
        </h3>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError('');
            }}
            placeholder="예: Water Drop, Botanical"
            className="w-full rounded px-2.5 py-1.5 text-xs"
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
            색상
          </label>
          <div className="flex flex-wrap gap-2">
            {DIRECTION_COLOR_PRESETS.map((presetColor) => {
              const selected = color === presetColor;

              return (
                <button
                  key={presetColor}
                  className="h-6 w-6 rounded-full transition-transform"
                  style={{
                    backgroundColor: presetColor,
                    outline: selected
                      ? '2px solid var(--text-primary)'
                      : 'none',
                    outlineOffset: 2,
                    transform: selected ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onClick={() => setColor(presetColor)}
                  disabled={isCreating}
                  aria-label={`색상 ${presetColor}`}
                />
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-xs"
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
            className="rounded px-3 py-1.5 text-xs font-semibold"
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
