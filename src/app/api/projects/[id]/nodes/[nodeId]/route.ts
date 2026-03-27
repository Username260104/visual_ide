import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import {
  createActivityEvents,
  type ActivityEventWriteInput,
} from '@/lib/activityEvents';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';
import {
  getNodeContentState,
  getPatchedNodeContentState,
  hasNodeContentChange,
} from '@/lib/nodeContent';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';
import { wouldCreateNodeCycle } from '@/lib/nodeTree';

async function findActiveDirection(projectId: string, directionId: string) {
  return prisma.direction.findFirst({
    where: {
      id: directionId,
      projectId,
      archivedAt: null,
    },
    select: { id: true, name: true },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const currentNode = await prisma.node.findFirst({
    where: {
      id: params.nodeId,
      projectId: params.id,
      archivedAt: null,
    },
  });

  if (!currentNode) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  if (body.parentNodeId !== undefined) {
    const nextParentId = body.parentNodeId as string | null;

    if (nextParentId !== null) {
      const parentNode = await prisma.node.findFirst({
        where: {
          id: nextParentId,
          projectId: params.id,
          archivedAt: null,
        },
        select: { id: true },
      });

      if (!parentNode) {
        return NextResponse.json(
          { error: 'Parent node must belong to the same active project.' },
          { status: 400 }
        );
      }
    }

    const projectNodes = await prisma.node.findMany({
      where: {
        projectId: params.id,
        archivedAt: null,
      },
      select: { id: true, parentNodeId: true },
    });

    if (wouldCreateNodeCycle(projectNodes, params.nodeId, nextParentId)) {
      return NextResponse.json(
        { error: 'Parent change would create a cycle.' },
        { status: 400 }
      );
    }
  }

  let nextDirectionName: string | null = null;

  if (body.directionId !== undefined && body.directionId !== null) {
    const direction = await findActiveDirection(params.id, body.directionId as string);

    if (!direction) {
      return NextResponse.json(
        { error: 'Direction must belong to the same active project.' },
        { status: 400 }
      );
    }

    nextDirectionName = direction.name;
  }

  const previousDirectionName = body.directionId !== undefined && currentNode.directionId
    ? (
        await prisma.direction.findFirst({
          where: {
            id: currentNode.directionId,
            projectId: params.id,
          },
          select: { name: true },
        })
      )?.name ?? null
    : null;

  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.parentNodeId !== undefined) data.parentNodeId = body.parentNodeId;
  if (body.directionId !== undefined) data.directionId = body.directionId;
  if (body.source !== undefined) data.source = body.source;
  if (body.prompt !== undefined || body.resolvedPrompt !== undefined) {
    data.prompt = body.resolvedPrompt ?? body.prompt ?? null;
  }
  if (body.userIntent !== undefined) data.userIntent = body.userIntent;
  if (body.resolvedPrompt !== undefined) data.resolvedPrompt = body.resolvedPrompt;
  if (body.promptSource !== undefined) data.promptSource = body.promptSource;
  if (body.seed !== undefined) data.seed = body.seed;
  if (body.modelUsed !== undefined) data.modelUsed = body.modelUsed;
  if (body.width !== undefined) data.width = body.width;
  if (body.height !== undefined) data.height = body.height;
  if (body.aspectRatio !== undefined) data.aspectRatio = body.aspectRatio;
  if (body.intentTags !== undefined) data.intentTags = body.intentTags;
  if (body.changeTags !== undefined) data.changeTags = body.changeTags;
  if (body.note !== undefined) data.note = body.note;
  if (body.status !== undefined) data.status = body.status;
  if (body.statusReason !== undefined) data.statusReason = body.statusReason;
  if (body.position !== undefined) {
    const position = body.position as { x: number; y: number };
    data.positionX = position.x;
    data.positionY = position.y;
  }

  const currentNodeContent = getNodeContentState(currentNode);
  const nextNodeContent = getPatchedNodeContentState(currentNodeContent, {
    imageUrl: body.imageUrl as string | undefined,
    prompt: body.prompt as string | null | undefined,
    userIntent: body.userIntent as string | null | undefined,
    resolvedPrompt: body.resolvedPrompt as string | null | undefined,
  });

  if (hasNodeContentChange(currentNodeContent, nextNodeContent)) {
    data.contentUpdatedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(mapPrismaNodeToNodeData(currentNode));
  }

  const node = await prisma.$transaction(async (tx) => {
    const updatedNode = await tx.node.update({
      where: { id: params.nodeId },
      data,
    });
    const nodeLabel = getNodeSequenceLabel(updatedNode);
    const events: ActivityEventWriteInput[] = [];

    if (currentNode.parentNodeId !== updatedNode.parentNodeId) {
      events.push({
        projectId: params.id,
        nodeId: updatedNode.id,
        directionId: updatedNode.directionId,
        kind: 'node-reparented' as const,
        payload: {
          nodeId: updatedNode.id,
          nodeLabel,
          fromParentNodeId: currentNode.parentNodeId,
          toParentNodeId: updatedNode.parentNodeId,
        },
      });
    }

    if (
      currentNode.status !== updatedNode.status ||
      currentNode.statusReason !== updatedNode.statusReason
    ) {
      events.push({
        projectId: params.id,
        nodeId: updatedNode.id,
        directionId: updatedNode.directionId,
        kind: 'node-status-changed' as const,
        payload: {
          nodeId: updatedNode.id,
          nodeLabel,
          fromStatus: currentNode.status,
          toStatus: updatedNode.status,
          fromStatusReason: currentNode.statusReason,
          toStatusReason: updatedNode.statusReason,
        },
      });
    }

    if (currentNode.directionId !== updatedNode.directionId) {
      events.push({
        projectId: params.id,
        nodeId: updatedNode.id,
        directionId: updatedNode.directionId ?? currentNode.directionId,
        kind: 'node-direction-changed' as const,
        payload: {
          nodeId: updatedNode.id,
          nodeLabel,
          fromDirectionId: currentNode.directionId,
          toDirectionId: updatedNode.directionId,
          fromDirectionName: previousDirectionName,
          toDirectionName:
            updatedNode.directionId === null ? null : nextDirectionName,
        },
      });
    }

    if (currentNode.note !== updatedNode.note) {
      events.push({
        projectId: params.id,
        nodeId: updatedNode.id,
        directionId: updatedNode.directionId,
        kind: 'node-note-saved' as const,
        payload: {
          nodeId: updatedNode.id,
          nodeLabel,
          before: currentNode.note,
          after: updatedNode.note,
        },
      });
    }

    await createActivityEvents(tx, events);
    return updatedNode;
  });

  return NextResponse.json(mapPrismaNodeToNodeData(node));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const currentNode = await prisma.node.findFirst({
    where: {
      id: params.nodeId,
      projectId: params.id,
      archivedAt: null,
    },
  });

  if (!currentNode) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  const previousDirectionName = currentNode.directionId
    ? (
        await prisma.direction.findFirst({
          where: {
            id: currentNode.directionId,
            projectId: params.id,
          },
          select: { name: true },
        })
      )?.name ?? null
    : null;
  const archivedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const detachedChildren = await tx.node.updateMany({
      where: {
        projectId: params.id,
        parentNodeId: params.nodeId,
        archivedAt: null,
      },
      data: {
        parentNodeId: null,
      },
    });

    await tx.node.update({
      where: { id: params.nodeId },
      data: {
        archivedAt,
      },
    });

    await createActivityEvents(tx, [
      {
        projectId: params.id,
        nodeId: currentNode.id,
        directionId: currentNode.directionId,
        kind: 'node-archived',
        payload: {
          nodeId: currentNode.id,
          nodeLabel: getNodeSequenceLabel(currentNode),
          directChildrenCount: detachedChildren.count,
          previousDirectionId: currentNode.directionId,
          previousDirectionName,
        },
      },
    ]);
  });

  return NextResponse.json({ ok: true });
}
