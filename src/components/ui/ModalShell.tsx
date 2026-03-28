'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export const WORKSPACE_MODAL_TARGET_ID = 'ide-workspace-viewport';

interface ModalShellProps {
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeDisabled?: boolean;
  position?: 'fixed' | 'absolute';
  portalTarget?: Element | DocumentFragment | null;
  backdropClassName?: string;
  panelClassName?: string;
  backdropStyle?: CSSProperties;
  panelStyle?: CSSProperties;
}

export function ModalShell({
  children,
  onClose,
  closeOnBackdrop = true,
  closeDisabled = false,
  position = 'fixed',
  portalTarget,
  backdropClassName,
  panelClassName,
  backdropStyle,
  panelStyle,
}: ModalShellProps) {
  const handleBackdropClick = () => {
    if (closeOnBackdrop && !closeDisabled) {
      onClose?.();
    }
  };

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const content = (
    <div
      className={cn(
        position === 'fixed' ? 'fixed inset-0' : 'absolute inset-0',
        'z-50 flex items-center justify-center dialog-backdrop',
        backdropClassName
      )}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        ...backdropStyle,
      }}
      onClick={handleBackdropClick}
    >
      <div
        className={cn('rounded-lg dialog-content', panelClassName)}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          ...panelStyle,
        }}
        onClick={handlePanelClick}
      >
        {children}
      </div>
    </div>
  );

  return portalTarget ? createPortal(content, portalTarget) : content;
}
