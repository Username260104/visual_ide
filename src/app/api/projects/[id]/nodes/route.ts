import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';

// GET /api/projects/[id]/nodes
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const nodes = await prisma.node.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(nodes.map(mapPrismaNodeToNodeData));
}

// POST /api/projects/[id]/nodes
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  if (body.parentNodeId) {
    const parentNode = await prisma.node.findUnique({
      where: { id: body.parentNodeId },
      select: { id: true, projectId: true },
    });

    if (!parentNode || parentNode.projectId !== params.id) {
      return NextResponse.json(
        { error: 'Parent node must belong to the same project.' },
        { status: 400 }
      );
    }
  }

  // Calculate version number
  const count = await prisma.node.count({
    where: { projectId: params.id, directionId: body.directionId ?? null },
  });

  const node = await prisma.node.create({
    data: {
      projectId: params.id,
      imageUrl: body.imageUrl ?? '',
      parentNodeId: body.parentNodeId ?? null,
      directionId: body.directionId ?? null,
      source: body.source ?? 'imported',
      prompt: body.prompt ?? null,
      seed: body.seed ?? null,
      modelUsed: body.modelUsed ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      aspectRatio: body.aspectRatio ?? null,
      intentTags: body.intentTags ?? [],
      changeTags: body.changeTags ?? [],
      note: body.note ?? '',
      status: body.status ?? 'unclassified',
      statusReason: body.statusReason ?? null,
      versionNumber: count + 1,
      positionX: body.position?.x ?? 0,
      positionY: body.position?.y ?? 0,
    },
  });

  return NextResponse.json(mapPrismaNodeToNodeData(node));
}
