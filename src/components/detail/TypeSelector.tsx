'use client';

import { TYPE_LABELS } from '@/lib/constants';
import type { NodeType } from '@/lib/types';

const TYPES: NodeType[] = ['moodboard', 'reference', 'main'];

interface TypeSelectorProps {
  nodeType: NodeType;
  onTypeChange: (nodeType: NodeType) => void;
}

export function TypeSelector({
  nodeType,
  onTypeChange,
}: TypeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        유형
      </label>

      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((item) => {
          const selected = nodeType === item;

          return (
            <button
              key={item}
              onClick={() => onTypeChange(item)}
              className="rounded px-2.5 py-1 text-xs transition-colors"
              style={{
                backgroundColor: selected ? 'var(--bg-active)' : 'var(--bg-input)',
                color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `1px solid ${
                  selected ? 'var(--border-focus)' : 'var(--border-default)'
                }`,
              }}
            >
              {TYPE_LABELS[item]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
