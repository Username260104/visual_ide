import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';
import { getNextProjectNodeOrdinal, withNodeOrdinalRetry } from '@/lib/nodeOrdinals';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';

async function findActiveDirection(projectId: string, directionId: string) {
  return prisma.direction.findFirst({
    where: {
      id: directionId,
      projectId,
      archivedAt: null,
    },
    select: { id: true },
  });
}

function getNodeSource(value: unknown) {
  return value === 'ai-generated' ? 'ai-generated' : 'imported';
}

function getDefaultNodeType(source: string) {
  return source === 'ai-generated' ? 'main' : 'reference';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const scope = request.nextUrl.searchParams.get('scope') ?? 'active';
  const archivedAtFilter: null | { not: null } | undefined =
    scope === 'archived'
      ? { not: null }
      : scope === 'all'
        ? undefined
        : null;

  const nodes = await prisma.node.findMany({
    where: {
      projectId: params.id,
      ...(archivedAtFilter === undefined
        ? {}
        : { archivedAt: archivedAtFilter }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(nodes.map(mapPrismaNodeToNodeData));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.parentNodeId) {
    const parentNode = await prisma.node.findFirst({
      where: {
        id: body.parentNodeId,
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

  if (body.directionId) {
    const direction = await findActiveDirection(params.id, body.directionId);

    if (!direction) {
      return NextResponse.json(
        { error: 'Direction must belong to the same active project.' },
        { status: 400 }
      );
    }
  }

  const source = getNodeSource(body.source);
  const nodeType = body.nodeType ?? getDefaultNodeType(source);
  const resolvedPrompt = body.resolvedPrompt ?? body.prompt ?? null;
  const userIntent = body.userIntent ?? null;
  const node = await withNodeOrdinalRetry(() =>
    prisma.$transaction(async (tx) => {
      const count = await tx.node.count({
        where: {
          projectId: params.id,
          directionId: body.directionId ?? null,
          archivedAt: null,
        },
      });
      const nextNodeOrdinal = await getNextProjectNodeOrdinal(tx, params.id);

      const createdNode = await tx.node.create({
        data: {
          projectId: params.id,
          imageUrl: body.imageUrl ?? '',
          parentNodeId: body.parentNodeId ?? null,
          directionId: body.directionId ?? null,
          source,
          prompt: resolvedPrompt,
          userIntent,
          resolvedPrompt,
          promptSource: body.promptSource ?? null,
          seed: body.seed ?? null,
          modelUsed: body.modelUsed ?? null,
          width: body.width ?? null,
          height: body.height ?? null,
          aspectRatio: body.aspectRatio ?? null,
          intentTags: body.intentTags ?? [],
          changeTags: body.changeTags ?? [],
          note: body.note ?? '',
          nodeType,
          status: body.status ?? 'reviewing',
          statusReason: body.statusReason ?? null,
          nodeOrdinal: nextNodeOrdinal,
          versionNumber: count + 1,
          positionX: body.position?.x ?? 0,
          positionY: body.position?.y ?? 0,
        },
      });

      await createActivityEvent(tx, {
        projectId: params.id,
        nodeId: createdNode.id,
        directionId: createdNode.directionId,
        kind: 'node-created',
        payload: {
          nodeId: createdNode.id,
          nodeLabel: getNodeSequenceLabel(createdNode),
          parentNodeId: createdNode.parentNodeId,
          directionId: createdNode.directionId,
          source: createdNode.source,
          nodeType: createdNode.nodeType,
          status: createdNode.status,
          nodeOrdinal: createdNode.nodeOrdinal,
          promptSource: createdNode.promptSource,
        },
      });

      return createdNode;
    })
  );

  return NextResponse.json(mapPrismaNodeToNodeData(node));
}
