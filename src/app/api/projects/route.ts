import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaProjectToProject } from '@/lib/mappers';

// GET /api/projects — list all projects
export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { nodes: true, directions: true } } },
  });

  return NextResponse.json(projects.map(mapPrismaProjectToProject));
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  const { name, description } = await request.json();

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name, description: description ?? '' },
    include: { _count: { select: { nodes: true, directions: true } } },
  });

  return NextResponse.json(mapPrismaProjectToProject(project));
}
