'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type { NodeData } from '@/lib/types';

interface FullscreenImageViewerProps {
  node: NodeData | null;
  onClose: () => void;
}

export function FullscreenImageViewer({
  node,
  onClose,
}: FullscreenImageViewerProps) {
  useEffect(() => {
    if (!node) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [node, onClose]);

  if (!node || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="\uC774\uBBF8\uC9C0 \uD06C\uAC8C \uBCF4\uAE30"
    >
      <div className="relative flex h-full w-full items-center justify-center p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-6">
          <div
            className="max-w-[70vw] rounded-md px-3 py-2"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.42)',
              color: 'var(--text-inverse)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="text-sm font-semibold">{getNodeSequenceLabel(node)}</div>
            <div className="mt-1 text-xs text-white/70">
              {getResolutionLabel(node)}
            </div>
          </div>

          <button
            type="button"
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-85"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.56)',
              color: 'var(--text-inverse)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(10px)',
            }}
            onClick={onClose}
            aria-label="\uB2EB\uAE30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.imageUrl}
            alt={getNodeSequenceLabel(node)}
            className="max-h-full max-w-full object-contain select-none"
            style={{
              maxWidth: 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 48px)',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function getResolutionLabel(node: NodeData) {
  if (node.width && node.height) {
    return `${node.width} x ${node.height}`;
  }

  if (node.aspectRatio && node.aspectRatio !== 'custom') {
    return node.aspectRatio;
  }

  return '\uC6D0\uBCF8 \uC774\uBBF8\uC9C0';
}
