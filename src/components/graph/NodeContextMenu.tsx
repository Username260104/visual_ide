'use client';

import type { CSSProperties } from 'react';

export interface NodeContextMenuAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

interface NodeContextMenuProps {
  position: { x: number; y: number };
  actions: NodeContextMenuAction[];
  onClose: () => void;
}

export function NodeContextMenu({
  position,
  actions,
  onClose,
}: NodeContextMenuProps) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute min-w-[180px] rounded-md py-1"
        style={getMenuStyle(position)}
        onClick={(event) => event.stopPropagation()}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            className="flex w-full items-center px-3 py-2 text-left text-xs transition-colors"
            style={getItemStyle(action)}
            onClick={() => {
              if (action.disabled) {
                return;
              }

              action.onSelect();
              onClose();
            }}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getMenuStyle(position: { x: number; y: number }): CSSProperties {
  return {
    left: position.x,
    top: position.y,
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.36)',
  };
}

function getItemStyle(action: NodeContextMenuAction): CSSProperties {
  if (action.disabled) {
    return {
      color: 'var(--text-muted)',
      cursor: 'not-allowed',
      opacity: 0.45,
    };
  }

  if (action.tone === 'danger') {
    return {
      color: 'var(--status-dropped)',
      backgroundColor: 'transparent',
    };
  }

  return {
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  };
}
