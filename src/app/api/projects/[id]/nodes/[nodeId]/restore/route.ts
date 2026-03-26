import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const archivedNode = await prisma.node.findFirst({
    where: {
      id: params.nodeId,
      projectId: params.id,
      archivedAt: { not: null },
    },
  });

  if (!archivedNode) {
    return NextResponse.json({ error: 'Archived node not found' }, { status: 404 });
  }

  const restoredNode = await prisma.$transaction(async (tx) => {
    const activeParent = archivedNode.parentNodeId
      ? await tx.node.findFirst({
          where: {
            id: archivedNode.parentNodeId,
            projectId: params.id,
            archivedAt: null,
          },
          select: {
            id: true,
            nodeOrdinal: true,
            versionNumber: true,
          },
        })
      : null;

    const activeDirection = archivedNode.directionId
      ? await tx.direction.findFirst({
          where: {
            id: archivedNode.directionId,
            projectId: params.id,
            archivedAt: null,
          },
          select: { id: true, name: true },
        })
      : null;

    const updatedNode = await tx.node.update({
      where: { id: params.nodeId },
      data: {
        archivedAt: null,
        parentNodeId: activeParent ? archivedNode.parentNodeId : null,
        directionId: activeDirection ? archivedNode.directionId : null,
      },
    });

    await createActivityEvent(tx, {
      projectId: params.id,
      nodeId: updatedNode.id,
      directionId: updatedNode.directionId ?? archivedNode.directionId,
      kind: 'node-restored',
      payload: {
        nodeId: updatedNode.id,
        nodeLabel: getNodeSequenceLabel(archivedNode),
        restoredParentNodeId: updatedNode.parentNodeId,
        restoredParentLabel: activeParent ? getNodeSequenceLabel(activeParent) : null,
        restoredDirectionId: updatedNode.directionId,
        restoredDirectionName: activeDirection?.name ?? null,
        parentRecovered: Boolean(activeParent),
        directionRecovered: Boolean(activeDirection),
      },
    });

    return updatedNode;
  });

  return NextResponse.json(mapPrismaNodeToNodeData(restoredNode));
}
