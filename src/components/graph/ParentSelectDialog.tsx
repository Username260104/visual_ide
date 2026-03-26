'use client';

import { useMemo, useState } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { NODE_ATTACHMENT_GAP, NODE_CHILD_OFFSET_Y } from '@/lib/nodeLayout';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';

export function ParentSelectDialog() {
  const pendingDrop = useUIStore((state) => state.pendingDrop);
  const setPendingDrop = useUIStore((state) => state.setPendingDrop);
  const nodes = useNodeStore((state) => state.nodes);
  const addNode = useNodeStore((state) => state.addNode);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nodeList = useMemo(
    () =>
      Object.values(nodes).sort((left, right) => right.createdAt - left.createdAt),
    [nodes]
  );

  if (!pendingDrop) {
    return null;
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError('');
      setPendingDrop(null);
    }
  };

  const handleSelect = async (parentNodeId: string | null) => {
    if (isSubmitting) {
      return;
    }

    const { imageUrls, position } = pendingDrop;
    const parentNode = parentNodeId ? nodes[parentNodeId] : null;

    setIsSubmitting(true);
    setError('');

    try {
      await Promise.all(
        imageUrls.map((imageUrl, index) =>
          addNode({
            imageUrl,
            source: 'imported',
            parentNodeId,
            directionId: parentNode?.directionId ?? null,
            position: {
              x: parentNode
                ? parentNode.position.x + index * NODE_ATTACHMENT_GAP
                : position.x + index * NODE_ATTACHMENT_GAP,
              y: parentNode ? parentNode.position.y + NODE_CHILD_OFFSET_Y : position.y,
            },
          })
        )
      );

      setPendingDrop(null);
    } catch (selectionError) {
      console.error('Failed to attach dropped images:', selectionError);
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : '이미지를 노드에 연결하지 못했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      position="absolute"
      onClose={handleClose}
      closeDisabled={isSubmitting}
      panelClassName="flex max-h-[480px] w-[320px] flex-col gap-3 p-4"
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        연결 위치 선택
      </h3>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        새 이미지를 루트로 추가하거나, 기존 이미지 아래에 자식으로 연결할 수
        있습니다.
      </p>

      <button
        className="flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-opacity hover:opacity-90"
        style={{
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
        }}
        onClick={() => void handleSelect(null)}
        disabled={isSubmitting}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--text-accent)',
          }}
        >
          R
        </span>
        <span>새 루트 이미지로 추가</span>
      </button>

      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        기존 이미지에 연결
      </div>

      <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
        {nodeList.map((node) => (
          <button
            key={node.id}
            className="flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid transparent',
            }}
            onClick={() => void handleSelect(node.id)}
            disabled={isSubmitting}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.imageUrl}
              alt={getNodeSequenceLabel(node)}
              className="h-8 w-8 shrink-0 rounded object-cover"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs">
                {getNodeSequenceLabel(node)}
                {node.parentNodeId ? '' : ' (루트)'}
              </span>
              <span
                className="truncate text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {node.id.slice(0, 8)}...
              </span>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
          {error}
        </p>
      )}
    </ModalShell>
  );
}
