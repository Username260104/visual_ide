'use client';

import { memo, useState, type SyntheticEvent } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  getNodeDisplaySize,
} from '@/lib/constants';
import type { NodeData } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';

const NODE_META_H = 44;
const NODE_BAR_H = 4;
const UNCLASSIFIED_LABEL = '\uBBF8\uBD84\uB958';
const AI_SOURCE_LABEL = `AI \uC0DD\uC131`;
const UPLOAD_SOURCE_LABEL = '\uC5C5\uB85C\uB4DC';

function ImageNodeComponent({
  data,
  selected = false,
  dragging = false,
}: NodeProps<NodeData>) {
  const directions = useDirectionStore((state) => state.directions);
  const updateNode = useNodeStore((state) => state.updateNode);
  const [measuredDimensions, setMeasuredDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const isActive = selected || dragging;
  const direction = data.directionId ? directions[data.directionId] : null;
  const directionColor = direction?.color ?? 'var(--border-default)';
  const directionLabel = direction?.name ?? UNCLASSIFIED_LABEL;
  const effectiveWidth = data.width ?? measuredDimensions?.width ?? null;
  const effectiveHeight = data.height ?? measuredDimensions?.height ?? null;
  const displaySize = getNodeDisplaySize(
    data.aspectRatio ?? null,
    effectiveWidth,
    effectiveHeight
  );
  const metaLabel = getMetaLabel(data, effectiveWidth, effectiveHeight);
  const handleClassName = `vide-handle vide-handle-passive ${
    isActive ? 'vide-handle-active' : ''
  }`;

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const naturalWidth = event.currentTarget.naturalWidth;
    const naturalHeight = event.currentTarget.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      return;
    }

    setMeasuredDimensions((current) => {
      if (
        current?.width === naturalWidth &&
        current.height === naturalHeight
      ) {
        return current;
      }

      return { width: naturalWidth, height: naturalHeight };
    });

    if (data.width === naturalWidth && data.height === naturalHeight) {
      return;
    }

    updateNode(data.id, {
      width: naturalWidth,
      height: naturalHeight,
      aspectRatio: data.aspectRatio ?? getAspectRatioLabel(naturalWidth, naturalHeight),
    });
  };

  return (
    <div
      className="group relative"
      style={{
        width: displaySize.w,
        height: displaySize.h + NODE_META_H + NODE_BAR_H,
        overflow: 'visible',
        transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      title={`${directionLabel}\n${metaLabel}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleClassName} vide-handle-target`}
      />

      <div
        className="relative overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--node-bg)',
          border: `2px solid ${
            isActive ? 'var(--node-border-selected)' : 'var(--node-border)'
          }`,
          borderRadius: 8,
          boxShadow: isActive
            ? '0 0 0 1px var(--node-border-selected), 0 8px 20px rgba(0, 0, 0, 0.45)'
            : '0 4px 12px var(--node-shadow)',
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: '100%',
            height: displaySize.h,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt={`v${data.versionNumber}`}
            className="h-full w-full object-contain"
            draggable={false}
            onLoad={handleImageLoad}
          />

          <div
            className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.68)',
              color: 'var(--text-inverse)',
              backdropFilter: 'blur(4px)',
            }}
          >
            v{data.versionNumber}
          </div>

          <div
            className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: STATUS_COLORS[data.status],
              color:
                data.status === 'reviewing'
                  ? 'var(--bg-base)'
                  : 'var(--text-inverse)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
            }}
            title={STATUS_LABELS[data.status]}
          >
            {STATUS_LABELS[data.status]}
          </div>
        </div>

        <div
          className="flex flex-col justify-center gap-0.5 px-2"
          style={{
            height: NODE_META_H,
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: directionColor }}
            />
            <span
              className="truncate font-medium"
              style={{ color: 'var(--text-primary)' }}
              title={directionLabel}
            >
              {directionLabel}
            </span>
          </div>
          <div
            className="truncate text-[10px]"
            style={{ color: 'var(--text-secondary)' }}
            title={metaLabel}
          >
            {metaLabel}
          </div>
        </div>

        <div
          className="w-full direction-bar-transition"
          style={{
            height: NODE_BAR_H,
            backgroundColor: directionColor,
          }}
        >
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`${handleClassName} vide-handle-source`}
      />
    </div>
  );
}

function getMetaLabel(
  node: NodeData,
  width?: number | null,
  height?: number | null
) {
  const parts = [
    node.source === 'ai-generated' ? AI_SOURCE_LABEL : UPLOAD_SOURCE_LABEL,
  ];

  const sizeLabel = getNodeSizeLabel(width, height);
  if (sizeLabel) {
    parts.push(sizeLabel);
  } else if (node.aspectRatio && node.aspectRatio !== 'custom') {
    parts.push(node.aspectRatio);
  }

  if (node.modelUsed) {
    parts.push(node.modelUsed);
  }

  return parts.join(' / ');
}

function getNodeSizeLabel(width?: number | null, height?: number | null) {
  if (!width || !height) {
    return null;
  }

  return `${width}x${height}`;
}

function getAspectRatioLabel(width: number, height: number) {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || 1;
}

export const ImageNode = memo(ImageNodeComponent);
