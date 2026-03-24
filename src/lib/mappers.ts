import type { Node as PrismaNode, Direction as PrismaDirection, Project as PrismaProject } from '@/generated/prisma/client';
import type { NodeData, Direction, Project, NodeSource, NodeStatus } from './types';

export function mapPrismaNodeToNodeData(n: PrismaNode): NodeData {
  return {
    id: n.id,
    projectId: n.projectId,
    imageUrl: n.imageUrl,
    createdAt: n.createdAt.getTime(),
    parentNodeId: n.parentNodeId,
    directionId: n.directionId,
    source: n.source as NodeSource,
    prompt: n.prompt,
    seed: n.seed,
    modelUsed: n.modelUsed,
    width: n.width,
    height: n.height,
    aspectRatio: n.aspectRatio,
    intentTags: n.intentTags,
    changeTags: n.changeTags,
    note: n.note,
    status: n.status as NodeStatus,
    statusReason: n.statusReason,
    versionNumber: n.versionNumber,
    position: { x: n.positionX, y: n.positionY },
  };
}

export function mapPrismaDirectionToDirection(
  d: PrismaDirection,
  nodeCount: number = 0
): Direction {
  return {
    id: d.id,
    projectId: d.projectId,
    name: d.name,
    color: d.color,
    nodeCount,
  };
}

export function mapPrismaProjectToProject(
  p: PrismaProject & { _count?: { nodes: number; directions: number } }
): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    thumbnailUrl: p.thumbnailUrl,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
    nodeCount: p._count?.nodes,
    directionCount: p._count?.directions,
  };
}
