import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';
import { wouldCreateNodeCycle } from '@/lib/nodeTree';

// PATCH /api/projects/[id]/nodes/[nodeId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const body = await request.json();
  const data: Record<string, unknown> = {};
  const currentNode = await prisma.node.findUnique({
    where: { id: params.nodeId },
    select: { id: true, projectId: true },
  });

  if (!currentNode || currentNode.projectId !== params.id) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  if (body.parentNodeId !== undefined) {
    const nextParentId = body.parentNodeId as string | null;

    if (nextParentId !== null) {
      const parentNode = await prisma.node.findUnique({
        where: { id: nextParentId },
        select: { id: true, projectId: true },
      });

      if (!parentNode || parentNode.projectId !== params.id) {
        return NextResponse.json(
          { error: 'Parent node must belong to the same project.' },
          { status: 400 }
        );
      }
    }

    const projectNodes = await prisma.node.findMany({
      where: { projectId: params.id },
      select: { id: true, parentNodeId: true },
    });

    if (wouldCreateNodeCycle(projectNodes, params.nodeId, nextParentId)) {
      return NextResponse.json(
        { error: 'Parent change would create a cycle.' },
        { status: 400 }
      );
    }
  }

  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.parentNodeId !== undefined) data.parentNodeId = body.parentNodeId;
  if (body.directionId !== undefined) data.directionId = body.directionId;
  if (body.source !== undefined) data.source = body.source;
  if (body.prompt !== undefined) data.prompt = body.prompt;
  if (body.seed !== undefined) data.seed = body.seed;
  if (body.modelUsed !== undefined) data.modelUsed = body.modelUsed;
  if (body.width !== undefined) data.width = body.width;
  if (body.height !== undefined) data.height = body.height;
  if (body.aspectRatio !== undefined) data.aspectRatio = body.aspectRatio;
  if (body.intentTags !== undefined) data.intentTags = body.intentTags;
  if (body.changeTags !== undefined) data.changeTags = body.changeTags;
  if (body.note !== undefined) data.note = body.note;
  if (body.status !== undefined) data.status = body.status;
  if (body.statusReason !== undefined) data.statusReason = body.statusReason;
  if (body.position !== undefined) {
    data.positionX = body.position.x;
    data.positionY = body.position.y;
  }

  const node = await prisma.node.update({
    where: { id: params.nodeId },
    data,
  });

  return NextResponse.json(mapPrismaNodeToNodeData(node));
}

// DELETE /api/projects/[id]/nodes/[nodeId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  await prisma.node.delete({ where: { id: params.nodeId } });
  return NextResponse.json({ ok: true });
}
