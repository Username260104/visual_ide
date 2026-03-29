'use client';

import { ModalShell } from '@/components/ui/ModalShell';

interface DestructiveActionDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  impacts?: string[];
  consequences?: string[];
  isSubmitting?: boolean;
  error?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function DestructiveActionDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  impacts = [],
  consequences = [],
  isSubmitting = false,
  error,
  onConfirm,
  onClose,
}: DestructiveActionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell
      onClose={onClose}
      closeDisabled={isSubmitting}
      panelClassName="flex w-[420px] flex-col gap-4 p-5"
    >
      <div className="flex flex-col gap-2">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>

      {impacts.length > 0 && (
        <section className="flex flex-col gap-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            영향 범위
          </p>
          <div
            className="rounded px-3 py-3 text-xs"
            style={{
              backgroundColor: 'var(--bg-active)',
              color: 'var(--text-primary)',
            }}
          >
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {impacts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {consequences.length > 0 && (
        <section className="flex flex-col gap-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            실행 후 변화
          </p>
          <div
            className="rounded border px-3 py-3 text-xs"
            style={{
              borderColor: 'var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {consequences.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--feedback-error)' }}>
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
          onClick={onClose}
          disabled={isSubmitting}
        >
          취소
        </button>
        <button
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: isSubmitting
              ? 'var(--bg-active)'
              : 'var(--status-dropped)',
            color: 'var(--text-inverse)',
            opacity: isSubmitting ? 0.7 : 1,
          }}
          onClick={() => void onConfirm()}
          disabled={isSubmitting}
        >
          {isSubmitting ? '처리 중...' : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
