import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { mapPrismaDirectionToDirection } from '@/lib/mappers';
import { prisma } from '@/lib/prisma';

const DIRECTION_STRATEGY_FIELDS = [
  'thesis',
  'fitCriteria',
  'antiGoal',
  'referenceNotes',
] as const;

const DIRECTION_FIELD_LABELS: Record<
  (typeof DIRECTION_STRATEGY_FIELDS)[number],
  string
> = {
  thesis: '방향 가설',
  fitCriteria: '적합 기준',
  antiGoal: '피해야 할 느낌',
  referenceNotes: '참고 메모',
};

async function findActiveDirection(projectId: string, directionId: string) {
  return prisma.direction.findFirst({
    where: {
      id: directionId,
      projectId,
      archivedAt: null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; dirId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const existingDirection = await findActiveDirection(params.id, params.dirId);
  if (!existingDirection) {
    return NextResponse.json({ error: 'Direction not found' }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  const name = readOptionalString(body, 'name');
  const color = readOptionalString(body, 'color');

  if (name.isInvalid || color.isInvalid) {
    return NextResponse.json(
      { error: 'Invalid direction update payload.' },
      { status: 400 }
    );
  }

  if (name.value !== undefined) data.name = name.value;
  if (color.value !== undefined) data.color = color.value;

  for (const field of DIRECTION_STRATEGY_FIELDS) {
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
    const nodeCount = await prisma.node.count({
      where: {
        directionId: existingDirection.id,
        archivedAt: null,
      },
    });

    return NextResponse.json(
      mapPrismaDirectionToDirection(existingDirection, nodeCount)
    );
  }

  const changedStrategyFields = DIRECTION_STRATEGY_FIELDS.filter((field) => {
    const nextValue = data[field];
    return typeof nextValue === 'string' && nextValue !== existingDirection[field];
  });

  const direction = await prisma.$transaction(async (tx) => {
    const updatedDirection = await tx.direction.update({
      where: { id: params.dirId },
      data,
    });

    if (changedStrategyFields.length > 0) {
      await createActivityEvent(tx, {
        projectId: params.id,
        directionId: updatedDirection.id,
        kind: 'direction-thesis-updated',
        actorType: 'designer',
        source: 'manual',
        summary: buildDirectionStrategySummary(
          updatedDirection.name,
          changedStrategyFields
        ),
        payload: {
          directionId: updatedDirection.id,
          directionName: updatedDirection.name,
          fieldsChanged: changedStrategyFields,
          thesis: updatedDirection.thesis,
          fitCriteria: updatedDirection.fitCriteria,
          antiGoal: updatedDirection.antiGoal,
          referenceNotes: updatedDirection.referenceNotes,
        },
      });
    }

    return updatedDirection;
  });

  const nodeCount = await prisma.node.count({
    where: {
      directionId: direction.id,
      archivedAt: null,
    },
  });

  return NextResponse.json(mapPrismaDirectionToDirection(direction, nodeCount));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; dirId: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const existingDirection = await findActiveDirection(params.id, params.dirId);
  if (!existingDirection) {
    return NextResponse.json({ error: 'Direction not found' }, { status: 404 });
  }

  const archivedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const detachedNodes = await tx.node.updateMany({
      where: {
        projectId: params.id,
        directionId: params.dirId,
        archivedAt: null,
      },
      data: {
        directionId: null,
      },
    });

    await tx.direction.update({
      where: { id: params.dirId },
      data: {
        archivedAt,
      },
    });

    await createActivityEvent(tx, {
      projectId: params.id,
      directionId: existingDirection.id,
      kind: 'direction-archived',
      payload: {
        directionId: existingDirection.id,
        directionName: existingDirection.name,
        color: existingDirection.color,
        affectedNodeCount: detachedNodes.count,
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

function buildDirectionStrategySummary(
  directionName: string,
  fields: readonly (typeof DIRECTION_STRATEGY_FIELDS)[number][]
) {
  const labels = fields.map((field) => DIRECTION_FIELD_LABELS[field]).join(', ');
  return `${directionName} 전략 업데이트 (${labels})`;
}
