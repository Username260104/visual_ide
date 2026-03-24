import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaProjectToProject } from '@/lib/mappers';

// GET /api/projects/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { _count: { select: { nodes: true, directions: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(mapPrismaProjectToProject(project));
}

// PATCH /api/projects/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl;

  const project = await prisma.project.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { nodes: true, directions: true } } },
  });

  return NextResponse.json(mapPrismaProjectToProject(project));
}

// DELETE /api/projects/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
