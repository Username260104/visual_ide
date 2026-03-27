'use client';

import { useMemo, useState } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { collectDescendantIds } from '@/lib/nodeTree';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type { NodeData } from '@/lib/types';
import { useNodeStore } from '@/stores/nodeStore';

interface ReparentNodeDialogProps {
  nodeId: string | null;
  onClose: () => void;
}

export function ReparentNodeDialog({
  nodeId,
  onClose,
}: ReparentNodeDialogProps) {
  const nodes = useNodeStore((state) => state.nodes);
  const patchNode = useNodeStore((state) => state.patchNode);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetNode = nodeId ? nodes[nodeId] : null;
  const nodeList = useMemo(() => Object.values(nodes), [nodes]);
  const validParents = useMemo(() => {
    if (!targetNode) {
      return [];
    }

    const excluded = collectDescendantIds(nodeList, targetNode.id);
    excluded.add(targetNode.id);

    return nodeList
      .filter((candidate) => !excluded.has(candidate.id))
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [nodeList, targetNode]);
  const currentParent = targetNode?.parentNodeId
    ? nodes[targetNode.parentNodeId]
    : null;

  if (!targetNode) {
    return null;
  }

  const handleSelect = async (parentNodeId: string | null) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await patchNode(targetNode.id, { parentNodeId });
      onClose();
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : '상위를 변경하지 못했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      onClose={() => {
        if (!isSubmitting) {
          setError('');
          onClose();
        }
      }}
      closeDisabled={isSubmitting}
      panelClassName="flex max-h-[520px] w-[360px] flex-col gap-3 p-4"
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        상위 변경
      </h3>

      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        <p>대상 이미지: {getNodeSequenceLabel(targetNode)}</p>
        <p className="mt-1">
          현재 상위: {currentParent ? getNodeSequenceLabel(currentParent) : '루트'}
        </p>
      </div>

      <div
        className="rounded px-3 py-2 text-[11px]"
        style={{
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-muted)',
        }}
      >
        상위만 변경합니다. 이미지의 고유 순번은 유지되고, 계보 정보만 새 구조에
        맞춰 다시 계산됩니다.
      </div>

      <button
        className="flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-opacity hover:opacity-90"
        style={{
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          opacity: targetNode.parentNodeId === null ? 0.5 : 1,
        }}
        onClick={() => void handleSelect(null)}
        disabled={isSubmitting || targetNode.parentNodeId === null}
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
        <span>루트로 분리</span>
      </button>

      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        상위 후보
      </div>

      <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
        {validParents.map((node) => (
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
            <NodeThumb node={node} />
          </button>
        ))}

        {validParents.length === 0 && (
          <p className="px-2 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            선택 가능한 상위 이미지가 없습니다.
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
          {error}
        </p>
      )}
    </ModalShell>
  );
}

function NodeThumb({ node }: { node: NodeData }) {
  return (
    <>
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
    </>
  );
}
