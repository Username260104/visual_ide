import { NextRequest, NextResponse } from 'next/server';
import {
  findActiveProject,
  mapProjectWithActiveCounts,
} from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { prisma } from '@/lib/prisma';

const PROJECT_STRATEGY_FIELDS = [
  'brief',
  'constraints',
  'targetAudience',
  'brandTone',
] as const;

const PROJECT_FIELD_LABELS: Record<(typeof PROJECT_STRATEGY_FIELDS)[number], string> = {
  brief: '브리프',
  constraints: '제약 조건',
  targetAudience: '타깃 오디언스',
  brandTone: '브랜드 톤',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(await mapProjectWithActiveCounts(project));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existingProject = await findActiveProject(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  const name = readOptionalString(body, 'name');
  const description = readOptionalString(body, 'description', true);
  const thumbnailUrl = readOptionalNullableString(body, 'thumbnailUrl', true);

  if (name.isInvalid || description.isInvalid || thumbnailUrl.isInvalid) {
    return NextResponse.json(
      { error: 'Invalid project update payload.' },
      { status: 400 }
    );
  }

  if (name.value !== undefined) data.name = name.value;
  if (description.value !== undefined) data.description = description.value;
  if (thumbnailUrl.value !== undefined) data.thumbnailUrl = thumbnailUrl.value;

  for (const field of PROJECT_STRATEGY_FIELDS) {
    const parsed = readOptionalString(body, field, true);
    if (parsed.isInvalid) {
      return NextResponse.json(
        { error: `Invalid value for ${field}.` },
        { status: 400 }
      );
    }

    if (parsed.value !== undefined) {
      data[field] = parsed.value;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(await mapProjectWithActiveCounts(existingProject));
  }

  const changedStrategyFields = PROJECT_STRATEGY_FIELDS.filter((field) => {
    const nextValue = data[field];
    return typeof nextValue === 'string' && nextValue !== existingProject[field];
  });

  const project = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: params.id },
      data,
    });

    if (changedStrategyFields.length > 0) {
      await createActivityEvent(tx, {
        projectId: params.id,
        kind: 'brief-updated',
        actorType: 'designer',
        source: 'manual',
        summary: buildProjectStrategySummary(updatedProject.name, changedStrategyFields),
        payload: {
          projectId: updatedProject.id,
          projectName: updatedProject.name,
          fieldsChanged: changedStrategyFields,
          brief: updatedProject.brief,
          constraints: updatedProject.constraints,
          targetAudience: updatedProject.targetAudience,
          brandTone: updatedProject.brandTone,
        },
      });
    }

    return updatedProject;
  });

  return NextResponse.json(await mapProjectWithActiveCounts(project));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existingProject = await findActiveProject(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const archivedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: params.id },
      data: {
        archivedAt,
      },
    });

    await createActivityEvent(tx, {
      projectId: params.id,
      kind: 'project-archived',
      payload: {
        projectId: params.id,
        projectName: existingProject.name,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

function readOptionalString(
  body: Record<string, unknown>,
  key: string,
  allowNullAsEmpty: boolean = false
) {
  if (!(key in body)) {
    return { value: undefined, isInvalid: false };
  }

  const value = body[key];
  if (value === null && allowNullAsEmpty) {
    return { value: '', isInvalid: false };
  }

  if (typeof value !== 'string') {
    return { value: undefined, isInvalid: true };
  }

  return { value, isInvalid: false };
}

function readOptionalNullableString(
  body: Record<string, unknown>,
  key: string,
  allowNull: boolean = false
) {
  if (!(key in body)) {
    return { value: undefined, isInvalid: false };
  }

  const value = body[key];
  if (value === null && allowNull) {
    return { value: null, isInvalid: false };
  }

  if (typeof value !== 'string') {
    return { value: undefined, isInvalid: true };
  }

  return { value, isInvalid: false };
}

function buildProjectStrategySummary(
  projectName: string,
  fields: readonly (typeof PROJECT_STRATEGY_FIELDS)[number][]
) {
  const labels = fields.map((field) => PROJECT_FIELD_LABELS[field]).join(', ');
  return `${projectName} 전략 업데이트 (${labels})`;
}
