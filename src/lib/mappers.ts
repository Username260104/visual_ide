import type {
  ActivityEvent as PrismaActivityEvent,
  Node as PrismaNode,
  Direction as PrismaDirection,
  Project as PrismaProject,
} from '@/generated/prisma/client';
import type {
  ActivityEventActorType,
  ActivityEventData,
  ActivityEventKind,
  ActivityEventSource,
  NodeData,
  Direction,
  Project,
  JsonValue,
  NodeSource,
  NodeStatus,
  NodeType,
  PromptSource,
} from './types';

export function mapPrismaNodeToNodeData(n: PrismaNode): NodeData {
  return {
    id: n.id,
    projectId: n.projectId,
    imageUrl: n.imageUrl,
    createdAt: n.createdAt.getTime(),
    parentNodeId: n.parentNodeId,
    directionId: n.directionId,
    source: n.source as NodeSource,
    prompt: n.resolvedPrompt ?? n.prompt ?? n.userIntent,
    userIntent: n.userIntent,
    resolvedPrompt: n.resolvedPrompt,
    promptSource: n.promptSource as PromptSource | null,
    seed: n.seed,
    modelUsed: n.modelUsed,
    width: n.width,
    height: n.height,
    aspectRatio: n.aspectRatio,
    intentTags: n.intentTags,
    changeTags: n.changeTags,
    note: n.note,
    nodeType: n.nodeType as NodeType,
    status: n.status as NodeStatus,
    statusReason: n.statusReason,
    nodeOrdinal: n.nodeOrdinal,
    versionNumber: n.versionNumber,
    position: { x: n.positionX, y: n.positionY },
  };
}

export function mapPrismaActivityEventToActivityEventData(
  event: PrismaActivityEvent
): ActivityEventData {
  return {
    id: event.id,
    projectId: event.projectId,
    nodeId: event.nodeId,
    directionId: event.directionId,
    kind: event.kind as ActivityEventKind,
    actorType: event.actorType as ActivityEventActorType | null,
    actorLabel: event.actorLabel,
    source: event.source as ActivityEventSource,
    summary: event.summary,
    payload: event.payload as JsonValue,
    createdAt: event.createdAt.getTime(),
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
    thesis: d.thesis,
    fitCriteria: d.fitCriteria,
    antiGoal: d.antiGoal,
    referenceNotes: d.referenceNotes,
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
    brief: p.brief,
    constraints: p.constraints,
    targetAudience: p.targetAudience,
    brandTone: p.brandTone,
    thumbnailUrl: p.thumbnailUrl,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
    nodeCount: p._count?.nodes,
    directionCount: p._count?.directions,
  };
}
