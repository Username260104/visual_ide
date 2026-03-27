import type { Project as PrismaProject } from '@/generated/prisma/client';
import { mapPrismaProjectToProject } from '@/lib/mappers';
import { prisma } from '@/lib/prisma';

export async function findActiveProject(projectId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      archivedAt: null,
    },
  });
}

async function getActiveProjectSnapshot(projectId: string) {
  const [nodes, directions, latestNode] = await prisma.$transaction([
    prisma.node.count({
      where: {
        projectId,
        archivedAt: null,
      },
    }),
    prisma.direction.count({
      where: {
        projectId,
        archivedAt: null,
      },
    }),
    prisma.node.findFirst({
      where: {
        projectId,
        archivedAt: null,
      },
      orderBy: [
        { contentUpdatedAt: 'desc' },
        { nodeOrdinal: 'desc' },
      ],
      select: {
        imageUrl: true,
      },
    }),
  ]);

  return {
    counts: { nodes, directions },
    thumbnailUrl: latestNode?.imageUrl ?? null,
  };
}

export async function mapProjectWithActiveCounts(project: PrismaProject) {
  const snapshot = await getActiveProjectSnapshot(project.id);

  return mapPrismaProjectToProject({
    ...project,
    thumbnailUrl: snapshot.thumbnailUrl,
    _count: snapshot.counts,
  });
}
