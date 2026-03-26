import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { mapPrismaDirectionToDirection } from '@/lib/mappers';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; dirId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const archivedDirection = await prisma.direction.findFirst({
    where: {
      id: params.dirId,
      projectId: params.id,
      archivedAt: { not: null },
    },
  });

  if (!archivedDirection) {
    return NextResponse.json(
      { error: 'Archived direction not found' },
      { status: 404 }
    );
  }

  const direction = await prisma.$transaction(async (tx) => {
    const restoredDirection = await tx.direction.update({
      where: { id: params.dirId },
      data: {
        archivedAt: null,
      },
    });

    await createActivityEvent(tx, {
      projectId: params.id,
      directionId: restoredDirection.id,
      kind: 'direction-restored',
      payload: {
        directionId: restoredDirection.id,
        directionName: restoredDirection.name,
        color: restoredDirection.color,
      },
    });

    return restoredDirection;
  });

  const nodeCount = await prisma.node.count({
    where: {
      directionId: direction.id,
      archivedAt: null,
    },
  });

  return NextResponse.json(mapPrismaDirectionToDirection(direction, nodeCount));
}
