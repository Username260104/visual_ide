'use client';

import { ModalShell } from '@/components/ui/ModalShell';

interface StagingWarningDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  impacts?: string[];
  consequences?: string[];
  onConfirm: () => void;
  onClose: () => void;
}

export function StagingWarningDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  impacts = [],
  consequences = [],
  onConfirm,
  onClose,
}: StagingWarningDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell onClose={onClose} panelClassName="flex w-[420px] flex-col gap-4 p-5">
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
            현재 상태
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
            참고
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

      <div className="flex justify-end gap-2">
        <button
          className="rounded px-4 py-2 text-sm"
          style={{
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onClick={onClose}
        >
          취소
        </button>
        <button
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
          }}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
