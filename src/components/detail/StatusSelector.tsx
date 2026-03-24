'use client';

import type { NodeStatus } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';

const STATUSES: NodeStatus[] = [
  'unclassified',
  'reviewing',
  'promising',
  'final',
  'dropped',
];

interface StatusSelectorProps {
  status: NodeStatus;
  statusReason: string | null;
  onChange: (status: NodeStatus, reason: string | null) => void;
}

export function StatusSelector({
  status,
  statusReason,
  onChange,
}: StatusSelectorProps) {
  const reasonRequired = requiresStatusReason(status);
  const reasonValue = statusReason ?? '';

  const handleStatusClick = (nextStatus: NodeStatus) => {
    onChange(
      nextStatus,
      requiresStatusReason(nextStatus) ? reasonValue || null : null
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        상태
      </label>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((item) => {
          const selected = status === item;

          return (
            <button
              key={item}
              onClick={() => handleStatusClick(item)}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors"
              style={{
                backgroundColor: selected
                  ? 'var(--bg-selected)'
                  : 'var(--bg-input)',
                color: selected
                  ? 'var(--text-inverse)'
                  : 'var(--text-primary)',
                border: `1px solid ${
                  selected ? STATUS_COLORS[item] : 'var(--border-default)'
                }`,
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[item] }}
              />
              {STATUS_LABELS[item]}
            </button>
          );
        })}
      </div>

      {reasonRequired && (
        <input
          type="text"
          value={reasonValue}
          onChange={(event) => onChange(status, event.target.value || null)}
          placeholder={
            status === 'final'
              ? '최종 선택 이유를 적어 주세요.'
              : '보류 또는 탈락 이유를 적어 주세요.'
          }
          className="mt-1 w-full rounded px-2.5 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
        />
      )}
    </div>
  );
}

function requiresStatusReason(status: NodeStatus) {
  return status === 'final' || status === 'dropped';
}
