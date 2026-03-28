import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type { Direction, NodeData } from './types';

export interface ImageBridgeMetadataExport {
  version: 1;
  exportedAt: string;
  node: {
    id: string;
    label: string;
    imageUrl: string;
    source: NodeData['source'];
    prompt: string | null;
    userIntent: string | null;
    resolvedPrompt: string | null;
    promptSource: NodeData['promptSource'] | null;
    seed: number | null;
    modelUsed: string | null;
    width: number | null;
    height: number | null;
    aspectRatio: string | null;
    intentTags: string[];
    changeTags: string[];
    note: string;
    status: NodeData['status'];
    statusReason: string | null;
    parentNodeId: string | null;
    directionId: string | null;
    nodeOrdinal: number | null;
    versionNumber: number;
    position: { x: number; y: number };
    createdAt: number;
  };
  direction: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function buildImageBridgeMetadataExport(
  node: NodeData,
  direction: Direction | null
): ImageBridgeMetadataExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    node: {
      id: node.id,
      label: getNodeSequenceLabel(node),
      imageUrl: node.imageUrl,
      source: node.source,
      prompt: node.prompt ?? null,
      userIntent: node.userIntent ?? null,
      resolvedPrompt: node.resolvedPrompt ?? null,
      promptSource: node.promptSource ?? null,
      seed: node.seed ?? null,
      modelUsed: node.modelUsed ?? null,
      width: node.width ?? null,
      height: node.height ?? null,
      aspectRatio: node.aspectRatio ?? null,
      intentTags: [...node.intentTags],
      changeTags: [...node.changeTags],
      note: node.note,
      status: node.status,
      statusReason: node.statusReason ?? null,
      parentNodeId: node.parentNodeId,
      directionId: node.directionId,
      nodeOrdinal: node.nodeOrdinal ?? null,
      versionNumber: node.versionNumber,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      createdAt: node.createdAt,
    },
    direction: direction
      ? {
          id: direction.id,
          name: direction.name,
          color: direction.color,
        }
      : null,
  };
}

export function buildImageBridgeBaseFilename(node: NodeData) {
  return sanitizeFilename(`visual-ide-${getNodeSequenceLabel(node)}-${node.id.slice(0, 8)}`);
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'visual-ide-image';
}
