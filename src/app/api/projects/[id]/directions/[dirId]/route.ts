import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaDirectionToDirection } from '@/lib/mappers';

// PATCH /api/projects/[id]/directions/[dirId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; dirId: string } }
) {
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.color !== undefined) data.color = body.color;

  const direction = await prisma.direction.update({
    where: { id: params.dirId },
    data,
    include: { _count: { select: { nodes: true } } },
  });

  return NextResponse.json(
    mapPrismaDirectionToDirection(direction, direction._count.nodes)
  );
}

// DELETE /api/projects/[id]/directions/[dirId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; dirId: string } }
) {
  // Unassign nodes first, then delete
  await prisma.node.updateMany({
    where: { directionId: params.dirId },
    data: { directionId: null },
  });
  await prisma.direction.delete({ where: { id: params.dirId } });
  return NextResponse.json({ ok: true });
}
