import { NextRequest, NextResponse } from 'next/server';
import { mapProjectWithActiveCounts } from '@/lib/activeRecords';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get('scope') ?? 'active';
  const archivedAtFilter: null | { not: null } | undefined =
    scope === 'archived'
      ? { not: null }
      : scope === 'all'
        ? undefined
        : null;

  const projects = await prisma.project.findMany({
    where:
      archivedAtFilter === undefined
        ? undefined
        : { archivedAt: archivedAtFilter },
    orderBy: { updatedAt: 'desc' },
  });

  const serializedProjects = await Promise.all(
    projects.map((project) => mapProjectWithActiveCounts(project))
  );

  return NextResponse.json(serializedProjects);
}

export async function POST(request: NextRequest) {
  const { name, description } = await request.json();

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description ?? '',
    },
  });

  return NextResponse.json(await mapProjectWithActiveCounts(project));
}
