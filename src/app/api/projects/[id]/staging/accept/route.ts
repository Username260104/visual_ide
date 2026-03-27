import { NextRequest, NextResponse } from 'next/server';
import { findActiveProject } from '@/lib/activeRecords';
import { createActivityEvent } from '@/lib/activityEvents';
import { mapPrismaNodeToNodeData } from '@/lib/mappers';
import {
  NODE_ATTACHMENT_GAP,
  NODE_CHILD_OFFSET_Y,
  NODE_ROW_GAP,
} from '@/lib/nodeLayout';
import { getNextProjectNodeOrdinal, withNodeOrdinalRetry } from '@/lib/nodeOrdinals';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';
import type {
  PromptSource,
  StagingCandidateStatus,
  StagingSourceKind,
} from '@/lib/types';

const MAX_CANDIDATES = 20;
const MAX_TAGS = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await findActiveProject(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseAcceptBody(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  if (parsed.value.batch.projectId !== params.id) {
    return NextResponse.json(
      { error: 'Batch project must match the current project.' },
      { status: 400 }
    );
  }

  try {
    const result = await withNodeOrdinalRetry(() =>
      prisma.$transaction(async (tx) => {
      const parentNode = parsed.value.batch.parentNodeId
        ? await tx.node.findFirst({
            where: {
              id: parsed.value.batch.parentNodeId,
              projectId: params.id,
              archivedAt: null,
            },
            select: {
              id: true,
              directionId: true,
              positionX: true,
              positionY: true,
            },
          })
        : null;

      if (parsed.value.batch.parentNodeId && !parentNode) {
        throw new AcceptError(
          'Parent node must belong to the same active project.',
          400
        );
      }

      const effectiveDirectionId =
        parsed.value.batch.directionId ?? parentNode?.directionId ?? null;

      if (effectiveDirectionId) {
        const direction = await tx.direction.findFirst({
          where: {
            id: effectiveDirectionId,
            projectId: params.id,
            archivedAt: null,
          },
          select: { id: true },
        });

        if (!direction) {
          throw new AcceptError(
            'Direction must belong to the same active project.',
            400
          );
        }
      }

      const candidateMap = new Map(
        parsed.value.batch.candidates.map((candidate) => [candidate.id, candidate])
      );
      const acceptedSet = new Set(parsed.value.acceptedCandidateIds);
      const acceptedCandidates = parsed.value.acceptedCandidateIds.map((candidateId) => {
        const candidate = candidateMap.get(candidateId);

        if (!candidate || candidate.status !== 'staged') {
          throw new AcceptError('Only staged candidates can be accepted.', 400);
        }

        return candidate;
      });

      if (acceptedCandidates.length === 0) {
        throw new AcceptError('At least one staged candidate must be accepted.', 400);
      }

      const rejectedCandidates = parsed.value.batch.candidates.filter(
        (candidate) =>
          candidate.status === 'staged' && !acceptedSet.has(candidate.id)
      );
      const discardedCandidates = parsed.value.batch.candidates.filter(
        (candidate) => candidate.status === 'discarded'
      );

      const existingNodes = await tx.node.findMany({
        where: {
          projectId: params.id,
          archivedAt: null,
        },
        select: {
          id: true,
          parentNodeId: true,
          positionX: true,
          positionY: true,
        },
      });
      const directionCount = await tx.node.count({
        where: {
          projectId: params.id,
          directionId: effectiveDirectionId,
          archivedAt: null,
        },
      });
      const positions = getAcceptedPositions(
        existingNodes,
        parentNode,
        acceptedCandidates.length
      );
      const nextNodeOrdinal = await getNextProjectNodeOrdinal(tx, params.id);
      const resolvedPrompt = parsed.value.batch.resolvedPrompt;
      const userIntent = parsed.value.batch.userIntent;
      const promptSource =
        parsed.value.batch.promptSource ??
        (parsed.value.batch.sourceKind === 'variation-panel'
          ? 'variation-derived'
          : 'user-authored');

      const createdNodes = [];

      for (let index = 0; index < acceptedCandidates.length; index += 1) {
        const candidate = acceptedCandidates[index];
        const createdNode = await tx.node.create({
          data: {
            projectId: params.id,
            imageUrl: candidate.imageUrl,
            parentNodeId: parentNode?.id ?? null,
            directionId: effectiveDirectionId,
            source: 'ai-generated',
            prompt: resolvedPrompt,
            userIntent,
            resolvedPrompt,
            promptSource,
            seed: null,
            modelUsed: parsed.value.batch.modelId,
            width: parsed.value.batch.width,
            height: parsed.value.batch.height,
            aspectRatio: parsed.value.batch.aspectRatio,
            intentTags: parsed.value.batch.intentTags,
            changeTags: parsed.value.batch.changeTags,
            note: parsed.value.batch.note ?? '',
            status: 'unclassified',
            statusReason: null,
            nodeOrdinal: nextNodeOrdinal + index,
            versionNumber: directionCount + index + 1,
            positionX: positions[index]?.x ?? 0,
            positionY: positions[index]?.y ?? 0,
          },
        });

        await createActivityEvent(tx, {
          projectId: params.id,
          nodeId: createdNode.id,
          directionId: createdNode.directionId,
          kind: 'node-created',
          payload: {
            nodeId: createdNode.id,
            nodeLabel: getNodeSequenceLabel(createdNode),
            parentNodeId: createdNode.parentNodeId,
            directionId: createdNode.directionId,
            source: createdNode.source,
            status: createdNode.status,
            nodeOrdinal: createdNode.nodeOrdinal,
            promptSource: createdNode.promptSource,
            acceptedFromBatchId: parsed.value.batch.id,
            candidateId: candidate.id,
          },
        });

        createdNodes.push(createdNode);
      }

      const comparisonEvent = await createActivityEvent(tx, {
        projectId: params.id,
        nodeId: parentNode?.id ?? createdNodes[0]?.id ?? null,
        directionId: effectiveDirectionId,
        kind: 'comparison-recorded',
        actorType: 'designer',
        actorLabel: '검토함',
        source: 'manual',
        summary: buildComparisonSummary(
          parsed.value.batch.sourceKind,
          acceptedCandidates.length,
          rejectedCandidates.length
        ),
        payload: {
          batchId: parsed.value.batch.id,
          sourceKind: parsed.value.batch.sourceKind,
          projectId: params.id,
          parentNodeId: parentNode?.id ?? null,
          directionId: effectiveDirectionId,
          userIntent,
          resolvedPrompt,
          promptSource,
          modelId: parsed.value.batch.modelId,
          modelLabel: parsed.value.batch.modelLabel,
          aspectRatio: parsed.value.batch.aspectRatio,
          width: parsed.value.batch.width,
          height: parsed.value.batch.height,
          intentTags: parsed.value.batch.intentTags,
          changeTags: parsed.value.batch.changeTags,
          note: parsed.value.batch.note,
          relatedNodeIds: [
            ...(parentNode?.id ? [parentNode.id] : []),
            ...createdNodes.map((node) => node.id),
          ],
          candidates: parsed.value.batch.candidates.map((candidate) => ({
            tempId: candidate.id,
            imageUrl: candidate.imageUrl,
            index: candidate.index,
            stagingStatus: candidate.status,
            comparisonResult: acceptedSet.has(candidate.id)
              ? 'accepted'
              : candidate.status === 'discarded'
                ? 'discarded-before-compare'
                : 'rejected',
          })),
          acceptedCandidateIds: acceptedCandidates.map((candidate) => candidate.id),
          rejectedCandidateIds: rejectedCandidates.map((candidate) => candidate.id),
          discardedCandidateIds: discardedCandidates.map((candidate) => candidate.id),
          acceptedNodeIds: createdNodes.map((node) => node.id),
          acceptedNodes: createdNodes.map((node, index) => ({
            candidateId: acceptedCandidates[index]?.id ?? null,
            nodeId: node.id,
            nodeLabel: getNodeSequenceLabel(node),
            imageUrl: node.imageUrl,
            index: acceptedCandidates[index]?.index ?? index,
          })),
          rationale: parsed.value.rationale,
        },
      });

      return {
        nodes: createdNodes.map(mapPrismaNodeToNodeData),
        comparisonEventId: comparisonEvent.id,
      };
      })
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AcceptError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to accept staging batch:', error);
    return NextResponse.json(
      { error: 'Failed to accept staging batch.' },
      { status: 500 }
    );
  }
}

interface ParsedAcceptBody {
  batch: ParsedBatch;
  acceptedCandidateIds: string[];
  rationale: string;
}

interface ParsedBatch {
  id: string;
  sourceKind: StagingSourceKind;
  projectId: string;
  parentNodeId: string | null;
  directionId: string | null;
  userIntent: string | null;
  resolvedPrompt: string | null;
  promptSource: PromptSource | null;
  modelId: string | null;
  modelLabel: string | null;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  intentTags: string[];
  changeTags: string[];
  note: string | null;
  candidates: ParsedCandidate[];
}

interface ParsedCandidate {
  id: string;
  imageUrl: string;
  index: number;
  status: StagingCandidateStatus;
}


class AcceptError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AcceptError';
    this.status = status;
  }
}

function parseAcceptBody(body: unknown):
  | { ok: true; value: ParsedAcceptBody }
  | { ok: false; error: string; status: number } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body.', status: 400 };
  }

  const bodyObject = body as Record<string, unknown>;
  const batchInput = getObject(bodyObject, 'batch');

  if (!batchInput) {
    return { ok: false, error: 'Batch is required.', status: 400 };
  }

  const batch = parseBatch(batchInput);
  if (!batch.ok) {
    return batch;
  }

  const acceptedCandidateIds = sanitizeStringArray(
    getArray(bodyObject, 'acceptedCandidateIds'),
    MAX_CANDIDATES,
    80
  );

  if (acceptedCandidateIds.length === 0) {
    return {
      ok: false,
      error: 'Select at least one candidate to accept.',
      status: 400,
    };
  }

  const rationale = getRequiredString(bodyObject, 'rationale', 4000);
  if (!rationale) {
    return {
      ok: false,
      error: 'Acceptance rationale is required.',
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      batch: batch.value,
      acceptedCandidateIds,
      rationale,
    },
  };
}

function parseBatch(batch: Record<string, unknown>):
  | { ok: true; value: ParsedBatch }
  | { ok: false; error: string; status: number } {
  const id = getRequiredString(batch, 'id', 80);
  const projectId = getRequiredString(batch, 'projectId', 80);
  const sourceKind = getSourceKind(batch);

  if (!id || !projectId || !sourceKind) {
    return {
      ok: false,
      error: 'A valid staging batch is required.',
      status: 400,
    };
  }

  const candidates = parseCandidates(getArray(batch, 'candidates'));
  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'Batch candidates are required.',
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      id,
      sourceKind,
      projectId,
      parentNodeId: getOptionalId(batch, 'parentNodeId'),
      directionId: getOptionalId(batch, 'directionId'),
      userIntent: getOptionalString(batch, 'userIntent', 4000),
      resolvedPrompt: getOptionalString(batch, 'resolvedPrompt', 8000),
      promptSource: getPromptSource(batch),
      modelId: getOptionalString(batch, 'modelId', 120),
      modelLabel: getOptionalString(batch, 'modelLabel', 120),
      aspectRatio: getOptionalString(batch, 'aspectRatio', 40),
      width: getOptionalNumber(batch, 'width'),
      height: getOptionalNumber(batch, 'height'),
      intentTags: sanitizeStringArray(getArray(batch, 'intentTags'), MAX_TAGS, 80),
      changeTags: sanitizeStringArray(getArray(batch, 'changeTags'), MAX_TAGS, 80),
      note: getOptionalString(batch, 'note', 4000),
      candidates,
    },
  };
}

function parseCandidates(candidates: unknown[]) {
  return candidates
    .slice(0, MAX_CANDIDATES)
    .map((candidate) => parseCandidate(candidate))
    .filter((candidate): candidate is ParsedCandidate => candidate !== null);
}

function parseCandidate(candidate: unknown): ParsedCandidate | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const candidateObject = candidate as Record<string, unknown>;
  const id = getRequiredString(candidateObject, 'id', 80);
  const imageUrl = getRequiredString(candidateObject, 'imageUrl', 4000);
  const index = getOptionalNumber(candidateObject, 'index');
  const status = getCandidateStatus(candidateObject);

  if (!id || !imageUrl || index === null || !status) {
    return null;
  }

  return {
    id,
    imageUrl,
    index,
    status,
  };
}

function getAcceptedPositions(
  nodes: Array<{
    id: string;
    parentNodeId: string | null;
    positionX: number;
    positionY: number;
  }>,
  parentNode:
    | {
        id: string;
        directionId: string | null;
        positionX: number;
        positionY: number;
      }
    | null,
  count: number
) {
  if (count <= 0) {
    return [];
  }

  if (parentNode) {
    const startX = parentNode.positionX - ((count - 1) * NODE_ATTACHMENT_GAP) / 2;
    const y = parentNode.positionY + NODE_CHILD_OFFSET_Y;

    return Array.from({ length: count }, (_, index) => ({
      x: startX + index * NODE_ATTACHMENT_GAP,
      y,
    }));
  }

  const rootNodes = nodes.filter((node) => node.parentNodeId === null);
  const startX =
    rootNodes.length === 0
      ? 0
      : Math.max(...rootNodes.map((node) => node.positionX)) + NODE_ATTACHMENT_GAP;
  const baseY =
    rootNodes.length === 0
      ? 0
      : Math.min(...rootNodes.map((node) => node.positionY));
  const y = Number.isFinite(baseY) ? baseY : NODE_ROW_GAP;

  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * NODE_ATTACHMENT_GAP,
    y,
  }));
}

function buildComparisonSummary(
  sourceKind: StagingSourceKind,
  acceptedCount: number,
  rejectedCount: number
) {
  const sourceLabel =
    sourceKind === 'variation-panel' ? '변형 후보' : '생성 후보';

  return `${sourceLabel} ${acceptedCount}개 채택, ${rejectedCount}개 기각`;
}

function getSourceKind(body: Record<string, unknown>) {
  const value = body.sourceKind;
  return value === 'generate-dialog' || value === 'variation-panel'
    ? value
    : null;
}

function getPromptSource(body: Record<string, unknown>) {
  const value = body.promptSource;
  return value === 'legacy' ||
    value === 'user-authored' ||
    value === 'ai-improved' ||
    value === 'variation-derived'
    ? value
    : null;
}

function getCandidateStatus(body: Record<string, unknown>) {
  const value = body.status;
  return value === 'staged' || value === 'accepted' || value === 'discarded'
    ? value
    : null;
}

function getObject(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getArray(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return Array.isArray(value) ? value : [];
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

function getRequiredString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = getOptionalString(body, key, maxLength);
  return value && value.trim() ? value : null;
}

function getOptionalId(body: Record<string, unknown>, key: string) {
  return getOptionalString(body, key, 80);
}

function getOptionalNumber(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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




