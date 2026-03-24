'use client';

import { useMemo, type ReactNode } from 'react';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import type { Direction, NodeData, NodeStatus } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';
import { StatusSelector } from './StatusSelector';
import { VariationPanel } from './VariationPanel';

const COPY = {
  variation: '\uBCC0\uD615 \uB9CC\uB4E4\uAE30',
  direction: 'Direction',
  unclassified: '\uBBF8\uBD84\uB958',
  lineage: '\uACC4\uBCF4',
  root: '\uB8E8\uD2B8',
  parent: '\uBD80\uBAA8',
  depth: '\uAE4A\uC774',
  step: '\uB2E8\uACC4',
  intentTags: '\uC758\uB3C4 \uD0DC\uADF8',
  changeTags: '\uBCC0\uACBD \uD0DC\uADF8',
  notes: '\uBA54\uBAA8',
  notePlaceholder: '\uBA54\uBAA8\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694',
  sourceInfo: '\uC0DD\uC131 \uC815\uBCF4',
  source: '\uCD9C\uCC98',
  generated: `AI \uC0DD\uC131`,
  uploaded: '\uC5C5\uB85C\uB4DC',
  model: '\uBAA8\uB378',
  size: '\uD06C\uAE30',
  ratio: '\uBE44\uC728',
  prompt: '\uD504\uB86C\uD504\uD2B8',
  seed: '\uC2DC\uB4DC',
  created: '\uC0DD\uC131\uC77C',
} as const;

export function DetailPanel() {
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const isOpen = useUIStore((state) => state.isDetailPanelOpen);
  const detailMode = useUIStore((state) => state.detailMode);
  const selectNode = useUIStore((state) => state.selectNode);
  const setDetailMode = useUIStore((state) => state.setDetailMode);
  const nodes = useNodeStore((state) => state.nodes);
  const updateNode = useNodeStore((state) => state.updateNode);
  const directions = useDirectionStore((state) => state.directions);

  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const parentNode = node?.parentNodeId ? nodes[node.parentNodeId] : null;
  const directionList = useMemo(() => Object.values(directions), [directions]);
  const currentDirection = node?.directionId ? directions[node.directionId] : null;
  const lineageDepth = useMemo(
    () => (node ? getLineageDepth(node, nodes) : 0),
    [node, nodes]
  );

  if (!isOpen || !node) return null;

  const handleBackToView = () => {
    setDetailMode('view');
  };

  const handleNavigateToParent = () => {
    if (node.parentNodeId) {
      selectNode(node.parentNodeId);
    }
  };

  const handleStatusChange = (
    status: NodeStatus,
    statusReason: string | null
  ) => {
    updateNode(node.id, { status, statusReason });
  };

  const handleDirectionChange = (directionId: string | null) => {
    updateNode(node.id, { directionId });
  };

  if (detailMode === 'variation') {
    return (
      <PanelContainer animated>
        <NodePreview node={node} compact />
        <VariationPanel node={node} onBack={handleBackToView} />
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <NodePreview node={node} />

      <div className="flex flex-col gap-4 p-4">
        <button
          className="flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent-secondary)',
            color: 'var(--text-inverse)',
          }}
          onClick={() => setDetailMode('variation')}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {COPY.variation}
        </button>

        <StatusSelector
          status={node.status}
          statusReason={node.statusReason}
          onChange={handleStatusChange}
        />

        <DirectionSection
          directionId={node.directionId}
          directions={directionList}
          currentDirection={currentDirection}
          onChange={handleDirectionChange}
        />

        <LineageSection
          node={node}
          parentNode={parentNode}
          lineageDepth={lineageDepth}
          onNavigateToParent={handleNavigateToParent}
        />

        {node.intentTags.length > 0 && (
          <PanelSection label={COPY.intentTags}>
            <TagList tags={node.intentTags} tone="accent" />
          </PanelSection>
        )}

        {node.changeTags.length > 0 && (
          <PanelSection label={COPY.changeTags}>
            <TagList tags={node.changeTags} tone="neutral" />
          </PanelSection>
        )}

        <PanelSection label={COPY.notes}>
          <textarea
            value={node.note}
            onChange={(event) =>
              updateNode(node.id, { note: event.target.value })
            }
            placeholder={COPY.notePlaceholder}
            rows={3}
            className="w-full resize-none rounded px-2.5 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          />
        </PanelSection>

        <SourceInfoSection node={node} />
      </div>
    </PanelContainer>
  );
}

function PanelContainer({
  children,
  animated = false,
}: {
  children: ReactNode;
  animated?: boolean;
}) {
  return (
    <div
      className={`flex w-[340px] shrink-0 flex-col overflow-y-auto border-l ${
        animated ? 'panel-slide-right' : ''
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      {children}
    </div>
  );
}

function NodePreview({
  node,
  compact = false,
}: {
  node: NodeData;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${
        compact ? 'h-[120px]' : 'aspect-square'
      }`}
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.imageUrl}
        alt={`v${node.versionNumber}`}
        className="h-full w-full object-contain"
      />

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span
          className="rounded px-2 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.62)',
            color: 'var(--text-inverse)',
            backdropFilter: 'blur(4px)',
          }}
        >
          v{node.versionNumber}
        </span>
        <span
          className="rounded px-2 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: STATUS_COLORS[node.status],
            color:
              node.status === 'reviewing' ? 'var(--bg-base)' : 'var(--text-inverse)',
          }}
        >
          {STATUS_LABELS[node.status]}
        </span>
      </div>
    </div>
  );
}

function DirectionSection({
  directionId,
  directions,
  currentDirection,
  onChange,
}: {
  directionId: string | null;
  directions: Direction[];
  currentDirection: Direction | null;
  onChange: (directionId: string | null) => void;
}) {
  return (
    <PanelSection label={COPY.direction}>
      <select
        value={directionId ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded px-2.5 py-1.5 text-xs"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: `1px solid ${
            currentDirection?.color ?? 'var(--border-default)'
          }`,
        }}
      >
        <option value="">{COPY.unclassified}</option>
        {directions.map((direction) => (
          <option key={direction.id} value={direction.id}>
            {direction.name}
          </option>
        ))}
      </select>

      {currentDirection && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentDirection.color }}
          />
          <span
            className="text-[10px]"
            style={{ color: currentDirection.color }}
          >
            {currentDirection.name}
          </span>
        </div>
      )}
    </PanelSection>
  );
}

function LineageSection({
  node,
  parentNode,
  lineageDepth,
  onNavigateToParent,
}: {
  node: NodeData;
  parentNode: NodeData | null;
  lineageDepth: number;
  onNavigateToParent: () => void;
}) {
  return (
    <PanelSection label={COPY.lineage}>
      <div
        className="flex flex-col gap-1 text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-1">
          <span>v{node.versionNumber}</span>
          {!node.parentNodeId && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--text-accent)',
              }}
            >
              {COPY.root}
            </span>
          )}
        </div>

        {parentNode && (
          <button
            className="flex items-center gap-1 text-left transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-accent)' }}
            onClick={onNavigateToParent}
          >
            <span>&larr;</span>
            <span>
              {COPY.parent} v{parentNode.versionNumber}
            </span>
          </button>
        )}

        {lineageDepth > 0 && (
          <div
            className="mt-0.5 text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {COPY.depth}: {lineageDepth}
            {COPY.step}
          </div>
        )}
      </div>
    </PanelSection>
  );
}

function TagList({
  tags,
  tone,
}: {
  tags: string[];
  tone: 'accent' | 'neutral';
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded px-2 py-0.5 text-[11px]"
          style={
            tone === 'accent'
              ? {
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-accent)',
                }
              : {
                  backgroundColor: 'var(--bg-active)',
                  color: 'var(--text-primary)',
                }
          }
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function SourceInfoSection({ node }: { node: NodeData }) {
  const rows = buildSourceInfoRows(node);

  return (
    <PanelSection label={COPY.sourceInfo}>
      <div className="flex flex-col gap-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3">
            <span
              className="w-14 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {row.label}
            </span>
            <span
              className={`min-w-0 flex-1 ${
                row.wrap ? 'break-words whitespace-pre-wrap' : 'truncate'
              }`}
              style={{ color: 'var(--text-secondary)' }}
              title={row.wrap ? undefined : row.value}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

function buildSourceInfoRows(node: NodeData) {
  const rows: Array<{ label: string; value: string; wrap?: boolean }> = [
    {
      label: COPY.source,
      value: node.source === 'ai-generated' ? COPY.generated : COPY.uploaded,
    },
  ];

  if (node.modelUsed) {
    rows.push({ label: COPY.model, value: node.modelUsed });
  }

  if (node.width && node.height) {
    rows.push({ label: COPY.size, value: `${node.width} x ${node.height}` });
  }

  if (node.aspectRatio && node.aspectRatio !== 'custom') {
    rows.push({ label: COPY.ratio, value: node.aspectRatio });
  }

  if (node.prompt) {
    rows.push({ label: COPY.prompt, value: node.prompt, wrap: true });
  }

  if (node.seed !== null) {
    rows.push({ label: COPY.seed, value: String(node.seed) });
  }

  rows.push({
    label: COPY.created,
    value: new Date(node.createdAt).toLocaleDateString('ko-KR'),
  });

  return rows;
}

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function getLineageDepth(node: NodeData, nodes: Record<string, NodeData>) {
  let depth = 0;
  let current: NodeData | undefined = node;
  const visited = new Set<string>();

  while (current?.parentNodeId) {
    if (visited.has(current.parentNodeId)) {
      break;
    }

    visited.add(current.parentNodeId);
    current = nodes[current.parentNodeId];
    depth += 1;
  }

  return depth;
}
