'use client';

import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface MaskPoint {
  x: number;
  y: number;
}

export interface MaskStroke {
  id: string;
  brushSizeRatio: number;
  points: MaskPoint[];
}

export interface ImageDimensions {
  width: number;
  height: number;
}

interface MaskEditorProps {
  imageUrl: string;
  brushSize: number;
  strokes: MaskStroke[];
  onChangeStrokes?: (next: MaskStroke[]) => void;
  onImageReady?: (dimensions: ImageDimensions) => void;
  disabled?: boolean;
  maxHeight?: number | string;
}

export function MaskEditor({
  imageUrl,
  brushSize,
  strokes,
  onChangeStrokes,
  onImageReady,
  disabled = false,
  maxHeight = 280,
}: MaskEditorProps) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(
    null
  );
  const [draftStroke, setDraftStroke] = useState<MaskStroke | null>(null);

  useEffect(() => {
    setDraftStroke(null);
  }, [imageUrl]);

  const isInteractive = !disabled && typeof onChangeStrokes === 'function';

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }

    const point = getRelativePoint(containerElement, event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = containerElement?.getBoundingClientRect();
    const minSide = Math.min(rect?.width ?? 1, rect?.height ?? 1);
    const brushSizeRatio = clampBrushRatio(brushSize / Math.max(minSide, 1));

    setDraftStroke({
      id: createStrokeId(),
      brushSizeRatio,
      points: [point],
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isInteractive || !draftStroke) {
      return;
    }

    const point = getRelativePoint(containerElement, event);
    if (!point) {
      return;
    }

    setDraftStroke((current) =>
      current
        ? {
            ...current,
            points: [...current.points, point],
          }
        : current
    );
  };

  const finalizeStroke = () => {
    if (!isInteractive) {
      setDraftStroke(null);
      return;
    }

    setDraftStroke((current) => {
      if (!current || current.points.length === 0) {
        return null;
      }

      onChangeStrokes?.([...strokes, current]);
      return null;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={setContainerElement}
        className="relative overflow-hidden rounded-lg border"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-active)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="mask source"
          className="block w-full object-contain"
          style={{
            maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          }}
          draggable={false}
          onLoad={(event) => {
            onImageReady?.({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            touchAction: isInteractive ? 'none' : 'auto',
            cursor: isInteractive ? 'crosshair' : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            finalizeStroke();
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            finalizeStroke();
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            {strokes.map((stroke) =>
              stroke.points.length <= 1 ? (
                <circle
                  key={stroke.id}
                  cx={stroke.points[0]?.x ?? 0}
                  cy={stroke.points[0]?.y ?? 0}
                  r={stroke.brushSizeRatio / 2}
                  fill="rgba(255, 88, 88, 0.85)"
                />
              ) : (
                <polyline
                  key={stroke.id}
                  points={stroke.points
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')}
                  fill="none"
                  stroke="rgba(255, 88, 88, 0.8)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={stroke.brushSizeRatio}
                />
              )
            )}
            {draftStroke &&
              (draftStroke.points.length <= 1 ? (
                <circle
                  cx={draftStroke.points[0]?.x ?? 0}
                  cy={draftStroke.points[0]?.y ?? 0}
                  r={draftStroke.brushSizeRatio / 2}
                  fill="rgba(255, 88, 88, 0.95)"
                />
              ) : (
                <polyline
                  points={draftStroke.points
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')}
                  fill="none"
                  stroke="rgba(255, 88, 88, 0.95)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={draftStroke.brushSizeRatio}
                />
              ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

export async function createMaskBlob(
  strokes: MaskStroke[],
  imageDimensions: ImageDimensions | null
) {
  if (!imageDimensions || strokes.length === 0) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = imageDimensions.width;
  canvas.height = imageDimensions.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#fff';
  context.fillStyle = '#fff';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const stroke of strokes) {
    const lineWidth = Math.max(
      4,
      stroke.brushSizeRatio *
        Math.min(imageDimensions.width, imageDimensions.height)
    );

    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      if (!point) {
        continue;
      }

      context.beginPath();
      context.arc(
        point.x * imageDimensions.width,
        point.y * imageDimensions.height,
        lineWidth / 2,
        0,
        Math.PI * 2
      );
      context.fill();
      continue;
    }

    context.beginPath();
    context.lineWidth = lineWidth;

    stroke.points.forEach((point, index) => {
      const x = point.x * imageDimensions.width;
      const y = point.y * imageDimensions.height;

      if (index === 0) {
        context.moveTo(x, y);
        return;
      }

      context.lineTo(x, y);
    });

    context.stroke();
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function getRelativePoint(
  element: HTMLDivElement | null,
  event: ReactPointerEvent<HTMLDivElement>
): MaskPoint | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01((event.clientY - rect.top) / rect.height),
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampBrushRatio(value: number) {
  return Math.min(0.25, Math.max(0.008, value));
}

function createStrokeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
