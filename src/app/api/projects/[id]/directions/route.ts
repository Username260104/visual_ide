import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaDirectionToDirection } from '@/lib/mappers';

// GET /api/projects/[id]/directions
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const directions = await prisma.direction.findMany({
    where: { projectId: params.id },
    include: { _count: { select: { nodes: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    directions.map((d) =>
      mapPrismaDirectionToDirection(d, d._count.nodes)
    )
  );
}

// POST /api/projects/[id]/directions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, color } = await request.json();

  if (!name || !color) {
    return NextResponse.json(
      { error: 'name and color are required' },
      { status: 400 }
    );
  }

  const direction = await prisma.direction.create({
    data: { projectId: params.id, name, color },
  });

  return NextResponse.json(mapPrismaDirectionToDirection(direction, 0));
}
