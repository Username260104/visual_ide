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

export async function getActiveProjectCounts(projectId: string) {
  const [nodes, directions] = await prisma.$transaction([
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
  ]);

  return { nodes, directions };
}

export async function mapProjectWithActiveCounts(project: PrismaProject) {
  const counts = await getActiveProjectCounts(project.id);

  return mapPrismaProjectToProject({
    ...project,
    _count: counts,
  });
}
