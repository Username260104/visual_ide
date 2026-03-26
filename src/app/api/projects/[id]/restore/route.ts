import { NextRequest, NextResponse } from 'next/server';
import { mapProjectWithActiveCounts } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const archivedProject = await prisma.project.findFirst({
    where: {
      id: params.id,
      archivedAt: { not: null },
    },
  });

  if (!archivedProject) {
    return NextResponse.json({ error: 'Archived project not found' }, { status: 404 });
  }

  const archiveStamp = archivedProject.archivedAt;

  const project = await prisma.$transaction(async (tx) => {
    const restoredProject = await tx.project.update({
      where: { id: params.id },
      data: {
        archivedAt: null,
      },
    });
    const restoredNodes = await tx.node.updateMany({
      where: {
        projectId: params.id,
        archivedAt: archiveStamp,
      },
      data: {
        archivedAt: null,
      },
    });
    const restoredDirections = await tx.direction.updateMany({
      where: {
        projectId: params.id,
        archivedAt: archiveStamp,
      },
      data: {
        archivedAt: null,
      },
    });

    await createActivityEvent(tx, {
      projectId: params.id,
      kind: 'project-restored',
      payload: {
        projectId: params.id,
        projectName: archivedProject.name,
        restoredLegacyNodeCount: restoredNodes.count,
        restoredLegacyDirectionCount: restoredDirections.count,
      },
    });

    return restoredProject;
  });

  return NextResponse.json(await mapProjectWithActiveCounts(project));
}
