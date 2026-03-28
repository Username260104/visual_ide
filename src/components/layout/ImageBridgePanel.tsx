'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { fetchJson } from '@/lib/clientApi';
import {
  buildImageBridgeBaseFilename,
  buildImageBridgeMetadataExport,
} from '@/lib/imageBridge';
import { NODE_ATTACHMENT_GAP, NODE_CHILD_OFFSET_Y } from '@/lib/nodeLayout';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type { NodeData } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';

interface UploadedImageAsset {
  imageUrl: string;
  imagePath: string;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;
}

export function ImageBridgePanel() {
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const nodes = useNodeStore((state) => state.nodes);
  const projectId = useNodeStore((state) => state.projectId);
  const addNode = useNodeStore((state) => state.addNode);
  const directions = useDirectionStore((state) => state.directions);

  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingMetadata, setIsExportingMetadata] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] ?? null : null;
  const selectedDirection = selectedNode?.directionId
    ? directions[selectedNode.directionId] ?? null
    : null;
  const nodeList = useMemo(() => Object.values(nodes), [nodes]);

  const importPlacementLabel = selectedNode
    ? `${getNodeSequenceLabel(selectedNode)} 아래 자식으로 추가`
    : '새 루트 이미지로 추가';

  const handleExportImage = async () => {
    if (!selectedNode) {
      setErrorMessage('내보낼 이미지를 먼저 선택해 주세요.');
      return;
    }

    setIsExportingImage(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(selectedNode.imageUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`이미지를 불러오지 못했습니다. (${response.status})`);
      }

      const blob = await response.blob();
      const extension = getImageExtension(blob.type, selectedNode.imageUrl);

      downloadBlob(
        blob,
        `${buildImageBridgeBaseFilename(selectedNode)}${extension}`
      );

      setStatusMessage('선택 이미지를 내보냈습니다.');
    } catch (error) {
      setErrorMessage(getActionErrorMessage(error, '이미지를 내보내지 못했습니다.'));
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleExportMetadata = async () => {
    if (!selectedNode) {
      setErrorMessage('메타데이터를 내보낼 이미지를 먼저 선택해 주세요.');
      return;
    }

    setIsExportingMetadata(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload = buildImageBridgeMetadataExport(
        selectedNode,
        selectedDirection
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });

      downloadBlob(blob, `${buildImageBridgeBaseFilename(selectedNode)}.json`);
      setStatusMessage('선택 이미지 메타데이터를 내보냈습니다.');
    } catch (error) {
      setErrorMessage(
        getActionErrorMessage(error, '메타데이터를 내보내지 못했습니다.')
      );
    } finally {
      setIsExportingMetadata(false);
    }
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    fileInputRef.current?.click();
  };

  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    );

    event.target.value = '';

    if (files.length === 0) {
      setErrorMessage('들여올 이미지 파일을 선택해 주세요.');
      return;
    }

    if (!projectId) {
      setErrorMessage('프로젝트가 아직 로드되지 않았습니다.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const createdParent = selectedNode ?? null;
    const basePosition = getImportBasePosition(nodeList, createdParent);
    let importedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      let upload: UploadedImageAsset | null = null;

      try {
        upload = await uploadImageFile(projectId, file);

        await addNode({
          imageUrl: upload.imageUrl,
          source: 'imported',
          parentNodeId: createdParent?.id ?? null,
          directionId: createdParent?.directionId ?? null,
          width: upload.width ?? null,
          height: upload.height ?? null,
          aspectRatio: upload.aspectRatio ?? null,
          position: {
            x: basePosition.x + index * NODE_ATTACHMENT_GAP,
            y: basePosition.y,
          },
        });

        importedCount += 1;
      } catch (error) {
        failedCount += 1;

        if (upload?.imagePath) {
          await deleteUploadedImage(upload.imagePath);
        }

        console.error('Failed to import image bridge asset:', error);
      }
    }

    if (importedCount > 0) {
      setStatusMessage(
        failedCount > 0
          ? `${importedCount}개 이미지를 들여왔고 ${failedCount}개는 실패했습니다.`
          : `${importedCount}개 이미지를 들여왔습니다.`
      );
    }

    if (importedCount === 0) {
      setErrorMessage('이미지를 들여오지 못했습니다.');
    } else if (failedCount > 0) {
      setErrorMessage('일부 이미지는 들여오지 못했습니다.');
    }

    setIsImporting(false);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              선택 이미지
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              현재 선택한 이미지를 바로 내보내고 메타 정보도 함께 저장할 수 있습니다.
            </p>
          </div>
          <span
            className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: selectedNode ? 'var(--accent-subtle)' : 'var(--bg-active)',
              color: selectedNode ? 'var(--text-accent)' : 'var(--text-muted)',
            }}
          >
            {selectedNode ? '선택됨' : '선택 없음'}
          </span>
        </div>

        {selectedNode ? (
          <div className="mt-3 flex flex-col gap-3">
            <div
              className="overflow-hidden rounded border"
              style={{ borderColor: 'var(--border-default)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedNode.imageUrl}
                alt={getNodeSequenceLabel(selectedNode)}
                className="h-40 w-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <InfoTile label="노드" value={getNodeSequenceLabel(selectedNode)} />
              <InfoTile
                label="브랜치"
                value={selectedDirection?.name ?? '미분류'}
              />
              <InfoTile
                label="크기"
                value={formatDimensions(selectedNode)}
              />
              <InfoTile label="상태" value={selectedNode.status} />
            </div>
          </div>
        ) : (
          <div
            className="mt-3 rounded border px-3 py-4 text-xs"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-active)',
              color: 'var(--text-muted)',
            }}
          >
            캔버스에서 이미지를 하나 선택하면 내보내기 버튼이 활성화됩니다.
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2">
          <ActionButton
            label={isExportingImage ? '내보내는 중...' : '이미지 내보내기'}
            onClick={() => void handleExportImage()}
            disabled={!selectedNode || isExportingImage || isExportingMetadata}
          />
          <ActionButton
            label={isExportingMetadata ? '저장 중...' : '메타 내보내기'}
            onClick={() => void handleExportMetadata()}
            disabled={!selectedNode || isExportingMetadata || isExportingImage}
            tone="secondary"
          />
        </div>
      </section>

      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          로컬 이미지 들여오기
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          로컬 이미지를 업로드해서 현재 프로젝트에 바로 추가합니다.
        </p>

        <div
          className="mt-3 rounded border px-3 py-2 text-[11px]"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-active)',
            color: 'var(--text-secondary)',
          }}
        >
          배치 위치: {importPlacementLabel}
        </div>

        <ActionButton
          label={isImporting ? '들여오는 중...' : '이미지 들여오기'}
          onClick={handleImportClick}
          disabled={!projectId || isImporting}
          className="mt-3"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleImportFiles(event)}
        />
      </section>

      {(statusMessage || errorMessage) && (
        <section
          className="rounded border px-3 py-2"
          style={{
            borderColor: errorMessage
              ? 'var(--status-dropped)'
              : 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {statusMessage && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {statusMessage}
            </p>
          )}
          {errorMessage && (
            <p
              className="text-xs"
              style={{ color: 'var(--status-dropped)', marginTop: statusMessage ? 6 : 0 }}
            >
              {errorMessage}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  tone = 'primary',
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <button
      className={`rounded px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
      style={{
        backgroundColor:
          tone === 'primary' ? 'var(--accent-primary)' : 'var(--bg-active)',
        color: tone === 'primary' ? 'var(--text-inverse)' : 'var(--text-primary)',
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded px-3 py-2"
      style={{ backgroundColor: 'var(--bg-active)' }}
    >
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function formatDimensions(node: NodeData) {
  if (node.width && node.height) {
    return `${node.width}x${node.height}`;
  }

  return node.aspectRatio ?? '미기록';
}

function getImportBasePosition(nodeList: NodeData[], parentNode: NodeData | null) {
  if (parentNode) {
    return {
      x: parentNode.position.x,
      y: parentNode.position.y + NODE_CHILD_OFFSET_Y,
    };
  }

  if (nodeList.length === 0) {
    return { x: 0, y: 0 };
  }

  const rightmostX = nodeList.reduce(
    (max, node) => Math.max(max, node.position.x),
    nodeList[0]?.position.x ?? 0
  );

  return {
    x: rightmostX + NODE_ATTACHMENT_GAP,
    y: 0,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function getImageExtension(contentType: string, fallbackUrl: string) {
  if (contentType.includes('png')) {
    return '.png';
  }

  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return '.jpg';
  }

  if (contentType.includes('gif')) {
    return '.gif';
  }

  if (contentType.includes('webp')) {
    return '.webp';
  }

  try {
    const pathname = new URL(fallbackUrl).pathname;
    const match = pathname.match(/\.(png|jpe?g|gif|webp)$/i);

    if (match) {
      return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
    }
  } catch {
    // ignore invalid URL parsing and use a safe default below
  }

  return '.png';
}

async function uploadImageFile(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('projectId', projectId);

  return fetchJson<UploadedImageAsset>('/api/upload-image', {
    method: 'POST',
    body: formData,
  });
}

async function deleteUploadedImage(imagePath: string) {
  try {
    await fetch('/api/upload-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    });
  } catch (error) {
    console.error('Failed to clean up uploaded bridge image:', error);
  }
}

function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
