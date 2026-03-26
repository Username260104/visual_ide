import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { mapPrismaDirectionToDirection } from '@/lib/mappers';
import { prisma } from '@/lib/prisma';

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

  const directions = await prisma.direction.findMany({
    where: {
      projectId: params.id,
      ...(archivedAtFilter === undefined
        ? {}
        : { archivedAt: archivedAtFilter }),
    },
    orderBy: { createdAt: 'asc' },
  });

  const serializedDirections = await Promise.all(
    directions.map(async (direction) => {
      const nodeCount = await prisma.node.count({
        where: {
          directionId: direction.id,
          archivedAt: null,
        },
      });

      return mapPrismaDirectionToDirection(direction, nodeCount);
    })
  );

  return NextResponse.json(serializedDirections);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { name, color } = await request.json();

  if (!name || !color) {
    return NextResponse.json(
      { error: 'name and color are required' },
      { status: 400 }
    );
  }

  const direction = await prisma.direction.create({
    data: {
      projectId: params.id,
      name,
      color,
    },
  });

  return NextResponse.json(mapPrismaDirectionToDirection(direction, 0));
}
