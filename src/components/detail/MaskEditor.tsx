'use client';

import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/lib/utils';

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
  fitToContainer?: boolean;
  className?: string;
}

export function MaskEditor({
  imageUrl,
  brushSize,
  strokes,
  onChangeStrokes,
  onImageReady,
  disabled = false,
  maxHeight = 280,
  fitToContainer = false,
  className,
}: MaskEditorProps) {
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null
  );
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(
    null
  );
  const [viewportSize, setViewportSize] = useState<ImageDimensions | null>(null);
  const [draftStroke, setDraftStroke] = useState<MaskStroke | null>(null);

  useEffect(() => {
    setDraftStroke(null);
    setImageDimensions(null);

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) {
        return;
      }

      const nextDimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      setImageDimensions(nextDimensions);
      onImageReady?.(nextDimensions);
    };
    image.src = imageUrl;

    return () => {
      disposed = true;
    };
  }, [imageUrl, onImageReady]);

  useEffect(() => {
    if (!fitToContainer || !viewportElement) {
      setViewportSize(null);
      return;
    }

    const updateViewportSize = () => {
      const rect = viewportElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setViewportSize(null);
        return;
      }

      setViewportSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateViewportSize();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });
    observer.observe(viewportElement);

    return () => {
      observer.disconnect();
    };
  }, [fitToContainer, viewportElement]);

  const isInteractive = !disabled && typeof onChangeStrokes === 'function';
  const fittedStageSize = fitToContainer
    ? getContainedSize(imageDimensions, viewportSize)
    : null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }

    const point = getRelativePoint(stageElement, event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = stageElement?.getBoundingClientRect();
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

    const point = getRelativePoint(stageElement, event);
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
    <div
      className={cn(
        'flex flex-col gap-2',
        fitToContainer ? 'h-full min-h-0' : '',
        className
      )}
    >
      {fitToContainer ? (
        <div
          ref={setViewportElement}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-active)',
          }}
        >
          {fittedStageSize ? (
            <div
              ref={setStageElement}
              className="relative shrink-0 overflow-hidden"
              style={{
                width: `${fittedStageSize.width}px`,
                height: `${fittedStageSize.height}px`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="mask source"
                className="block h-full w-full select-none"
                draggable={false}
              />

              <MaskOverlay
                strokes={strokes}
                draftStroke={draftStroke}
                isInteractive={isInteractive}
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
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          ref={setStageElement}
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
            className="block w-full object-contain select-none"
            style={{
              maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
            }}
            draggable={false}
          />

          <MaskOverlay
            strokes={strokes}
            draftStroke={draftStroke}
            isInteractive={isInteractive}
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
          />
        </div>
      )}
    </div>
  );
}

function MaskOverlay({
  strokes,
  draftStroke,
  isInteractive,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  strokes: MaskStroke[];
  draftStroke: MaskStroke | null;
  isInteractive: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        touchAction: isInteractive ? 'none' : 'auto',
        cursor: isInteractive ? 'crosshair' : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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
              fill="rgb(255, 88, 88)"
            />
          ) : (
            <polyline
              key={stroke.id}
              points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgb(255, 88, 88)"
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
              fill="rgb(255, 88, 88)"
            />
          ) : (
            <polyline
              points={draftStroke.points
                .map((point) => `${point.x},${point.y}`)
                .join(' ')}
              fill="none"
              stroke="rgb(255, 88, 88)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={draftStroke.brushSizeRatio}
            />
          ))}
      </svg>
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

function getContainedSize(
  imageDimensions: ImageDimensions | null,
  bounds: ImageDimensions | null
) {
  if (!imageDimensions || !bounds || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const scale = Math.min(
    bounds.width / imageDimensions.width,
    bounds.height / imageDimensions.height
  );

  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  return {
    width: Math.max(1, Math.round(imageDimensions.width * scale)),
    height: Math.max(1, Math.round(imageDimensions.height * scale)),
  };
}

function createStrokeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
