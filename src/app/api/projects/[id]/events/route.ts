import { NextRequest, NextResponse } from 'next/server';
import { createActivityEvent } from '@/lib/activityEvents';
import { findActiveProject } from '@/lib/activeRecords';
import { mapPrismaActivityEventToActivityEventData } from '@/lib/mappers';
import { prisma } from '@/lib/prisma';
import type {
  ActivityEventActorType,
  ActivityEventKind,
} from '@/lib/types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MANUAL_EVENT_KINDS = new Set<ActivityEventKind>([
  'feedback-recorded',
  'decision-recorded',
]);
const ACTOR_TYPES = new Set<ActivityEventActorType>([
  'client',
  'designer',
  'director',
  'unknown',
]);
const DECISION_TYPES = new Set([
  'final-selection',
  'promising-selection',
  'hold',
  'drop',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const nodeId = request.nextUrl.searchParams.get('nodeId');
  const directionId = request.nextUrl.searchParams.get('directionId');
  const kind = request.nextUrl.searchParams.get('kind');
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
  const paginate = request.nextUrl.searchParams.get('paginate') === 'true';
  const cursor = parseCursor(
    request.nextUrl.searchParams.get('cursorCreatedAt'),
    request.nextUrl.searchParams.get('cursorId')
  );

  const baseWhere = {
    projectId: params.id,
    ...(directionId ? { directionId } : {}),
    ...(kind ? { kind } : {}),
  };

  if (paginate && !nodeId) {
    const pageSize = limit;
    const cursorDate = cursor ? new Date(cursor.createdAt) : null;
    const cursorFilter =
      cursor && cursorDate
        ? {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { lt: cursor.id } },
            ],
          }
        : {};
    const pagedEvents = await prisma.activityEvent.findMany({
      where: {
        ...baseWhere,
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const hasMore = pagedEvents.length > pageSize;
    const pageEvents = hasMore ? pagedEvents.slice(0, pageSize) : pagedEvents;

    return NextResponse.json({
      events: pageEvents.map(mapPrismaActivityEventToActivityEventData),
      nextCursor:
        hasMore && pageEvents.length > 0
          ? toActivityEventCursor(pageEvents[pageEvents.length - 1])
          : null,
      hasMore,
    });
  }

  const events = nodeId
    ? (
        await prisma.activityEvent.findMany({
          where: baseWhere,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_LIMIT,
        })
      )
        .filter((event) => eventMatchesNode(event, nodeId))
        .slice(0, limit)
    : await prisma.activityEvent.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });

  return NextResponse.json(events.map(mapPrismaActivityEventToActivityEventData));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseManualEventBody(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const event = await prisma.$transaction(async (tx) => {
      if (parsed.value.nodeId) {
        const node = await tx.node.findFirst({
          where: {
            id: parsed.value.nodeId,
            projectId: params.id,
            archivedAt: null,
          },
          select: {
            id: true,
            directionId: true,
          },
        });

        if (!node) {
          throw new ManualEventError('Node not found', 404);
        }

        if (!parsed.value.directionId && node.directionId) {
          parsed.value.directionId = node.directionId;
        }
      }

      if (parsed.value.directionId) {
        const direction = await tx.direction.findFirst({
          where: {
            id: parsed.value.directionId,
            projectId: params.id,
            archivedAt: null,
          },
          select: { id: true },
        });

        if (!direction) {
          throw new ManualEventError('Direction not found', 404);
        }
      }

      return createActivityEvent(tx, {
        projectId: params.id,
        nodeId: parsed.value.nodeId,
        directionId: parsed.value.directionId,
        kind: parsed.value.kind,
        actorType: parsed.value.actorType,
        actorLabel: parsed.value.actorLabel,
        source: 'manual',
        payload: parsed.value.payload,
      });
    });

    return NextResponse.json(mapPrismaActivityEventToActivityEventData(event), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof ManualEventError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create manual event:', error);
    return NextResponse.json(
      { error: 'Failed to create activity event' },
      { status: 500 }
    );
  }
}

function parseLimit(limitValue: string | null) {
  if (!limitValue) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(limitValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseCursor(createdAtValue: string | null, idValue: string | null) {
  if (!createdAtValue || !idValue) {
    return null;
  }

  const createdAt = Number.parseInt(createdAtValue, 10);
  const id = idValue.trim().slice(0, 80);

  if (!Number.isFinite(createdAt) || createdAt <= 0 || !id) {
    return null;
  }

  return { createdAt, id };
}

function toActivityEventCursor(event: { id: string; createdAt: Date }) {
  return {
    id: event.id,
    createdAt: event.createdAt.getTime(),
  };
}

function parseManualEventBody(body: unknown):
  | { ok: true; value: ParsedManualEventBody }
  | { ok: false; error: string; status: number } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body', status: 400 };
  }

  const bodyObject = body as Record<string, unknown>;

  const kind = getManualEventKind(bodyObject);
  if (!kind) {
    return {
      ok: false,
      error: 'Only feedback-recorded and decision-recorded are supported.',
      status: 400,
    };
  }

  const payloadInput = getObject(bodyObject, 'payload');
  if (!payloadInput) {
    return { ok: false, error: 'Payload is required.', status: 400 };
  }

  const actorType = getActorType(bodyObject);
  const actorLabel = getOptionalString(bodyObject, 'actorLabel', 120);
  const nodeId = getOptionalId(bodyObject, 'nodeId');
  const directionId = getOptionalId(bodyObject, 'directionId');

  if (kind === 'feedback-recorded') {
    const text = getRequiredString(payloadInput, 'text', 4000);
    if (!text) {
      return {
        ok: false,
        error: 'Feedback text is required.',
        status: 400,
      };
    }

    const relatedNodeIds = withPrimaryNode(
      sanitizeStringArray(getArray(payloadInput, 'relatedNodeIds'), 20, 80),
      nodeId
    );

    return {
      ok: true,
      value: {
        kind,
        actorType,
        actorLabel,
        nodeId,
        directionId,
        payload: {
          nodeId,
          nodeLabel: getOptionalString(payloadInput, 'nodeLabel', 80),
          sourceType: actorType,
          sourceLabel:
            getOptionalString(payloadInput, 'sourceLabel', 120) ?? actorLabel,
          text,
          dimensions: sanitizeStringArray(
            getArray(payloadInput, 'dimensions'),
            12,
            40
          ),
          relatedNodeIds,
        },
      },
    };
  }

  const decisionType = getRequiredString(payloadInput, 'decisionType', 40);
  if (!decisionType || !DECISION_TYPES.has(decisionType)) {
    return {
      ok: false,
      error: 'A supported decisionType is required.',
      status: 400,
    };
  }

  const rationale = getRequiredString(payloadInput, 'rationale', 4000);
  if (!rationale) {
    return {
      ok: false,
      error: 'Decision rationale is required.',
      status: 400,
    };
  }

  const candidateNodeIds = withPrimaryNode(
    sanitizeStringArray(getArray(payloadInput, 'candidateNodeIds'), 20, 80),
    nodeId
  );
  const rejectedNodeIds = sanitizeStringArray(
    getArray(payloadInput, 'rejectedNodeIds'),
    20,
    80
  );

  return {
    ok: true,
    value: {
      kind,
      actorType,
      actorLabel,
      nodeId,
      directionId,
      payload: {
        nodeId,
        nodeLabel: getOptionalString(payloadInput, 'nodeLabel', 80),
        decisionType,
        rationale,
        chosenNodeId: getOptionalId(payloadInput, 'chosenNodeId'),
        chosenNodeLabel: getOptionalString(payloadInput, 'chosenNodeLabel', 80),
        candidateNodeIds,
        rejectedNodeIds,
        relatedNodeIds: withPrimaryNode(
          sanitizeStringArray(getArray(payloadInput, 'relatedNodeIds'), 20, 80),
          nodeId,
          candidateNodeIds
        ),
      },
    },
  };
}

interface ParsedManualEventBody {
  kind: 'feedback-recorded' | 'decision-recorded';
  actorType: ActivityEventActorType;
  actorLabel: string | null;
  nodeId: string | null;
  directionId: string | null;
  payload: {
    [key: string]: string | string[] | null;
  };
}

class ManualEventError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ManualEventError';
    this.status = status;
  }
}

function eventMatchesNode(
  event: { nodeId: string | null; payload: unknown },
  nodeId: string
) {
  if (event.nodeId === nodeId) {
    return true;
  }

  const payload = getPayloadObject(event.payload);
  if (!payload) {
    return false;
  }

  return (
    getOptionalString(payload, 'chosenNodeId', 80) === nodeId ||
    includesString(getArray(payload, 'relatedNodeIds'), nodeId) ||
    includesString(getArray(payload, 'candidateNodeIds'), nodeId) ||
    includesString(getArray(payload, 'rejectedNodeIds'), nodeId) ||
    includesString(getArray(payload, 'acceptedNodeIds'), nodeId) ||
    includesObjectString(getArray(payload, 'acceptedNodes'), 'nodeId', nodeId)
  );
}

function getManualEventKind(body: Record<string, unknown>) {
  const kind = body.kind;
  return typeof kind === 'string' && MANUAL_EVENT_KINDS.has(kind as ActivityEventKind)
    ? (kind as ParsedManualEventBody['kind'])
    : null;
}

function getActorType(body: Record<string, unknown>): ActivityEventActorType {
  const actorType = body.actorType;
  return typeof actorType === 'string' && ACTOR_TYPES.has(actorType as ActivityEventActorType)
    ? (actorType as ActivityEventActorType)
    : 'unknown';
}

function getObject(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getPayloadObject(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
}

function getArray(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return Array.isArray(value) ? value : [];
}

function getRequiredString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = getOptionalString(body, key, maxLength);
  return value && value.trim() ? value : null;
}

function getOptionalString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = body[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getOptionalId(body: Record<string, unknown>, key: string) {
  return getOptionalString(body, key, 80);
}

function sanitizeStringArray(values: unknown[], maxItems: number, maxLength: number) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((value) => value.slice(0, maxLength))
    )
  );
}

function includesString(values: unknown[], target: string) {
  return values.some((value) => typeof value === 'string' && value === target);
}

function includesObjectString(
  values: unknown[],
  key: string,
  target: string
) {
  return values.some((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    return Reflect.get(value, key) === target;
  });
}

function withPrimaryNode(
  values: string[],
  nodeId: string | null,
  extras: string[] = []
) {
  const all = [...values, ...extras];

  if (nodeId) {
    all.push(nodeId);
  }

  return Array.from(new Set(all));
}


