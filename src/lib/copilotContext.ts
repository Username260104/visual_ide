import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';
import type {
  CopilotCitation,
  CopilotClientContext,
  CopilotLiveStagingBatch,
} from '@/lib/types';
import type {
  ActivityEvent,
  Direction,
  Node,
  Project,
} from '@/generated/prisma/client';

const REVIEW_EVENT_KINDS = [
  'comparison-recorded',
  'feedback-recorded',
  'decision-recorded',
] as const;

export type ProjectCopilotContextResult =
  | {
      kind: 'ok';
      promptContext: string;
      citationIndex: Record<string, CopilotCitation>;
    }
  | { kind: 'project-not-found' }
  | { kind: 'selected-node-not-found' };

export async function buildProjectCopilotContext(
  projectId: string,
  selectedNodeId: string | null,
  clientContext: CopilotClientContext | null = null
): Promise<ProjectCopilotContextResult> {
  const [project, directions, nodes, reviewEvents] = await prisma.$transaction([
    prisma.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
      },
    }),
    prisma.direction.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.node.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      orderBy: [{ nodeOrdinal: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.activityEvent.findMany({
      where: {
        projectId,
        kind: {
          in: [...REVIEW_EVENT_KINDS],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: selectedNodeId ? 40 : 16,
    }),
  ]);

  if (!project) {
    return { kind: 'project-not-found' };
  }

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  if (selectedNodeId && !selectedNode) {
    return { kind: 'selected-node-not-found' };
  }

  const directionsById = Object.fromEntries(
    directions.map((direction) => [direction.id, direction])
  );
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const citationIndex: Record<string, CopilotCitation> = {};
  const lines: string[] = [
    '# Internal Project Data',
    'Use only the data below when answering the user question.',
  ];

  appendProjectSection(lines, citationIndex, project);
  appendDirectionSection(lines, citationIndex, directions);

  if (selectedNode) {
    appendNodeSection(
      lines,
      citationIndex,
      selectedNode,
      directionsById,
      'Selected Node'
    );
  }

  const remainingNodes = selectedNode
    ? nodes.filter((node) => node.id !== selectedNode.id)
    : nodes;

  appendNodesSection(lines, citationIndex, remainingNodes, directionsById);
  appendLiveStagingSection(
    lines,
    citationIndex,
    selectRelevantLiveStagingBatches(
      clientContext?.liveStagingBatches ?? [],
      projectId,
      selectedNode
    ),
    nodesById,
    directionsById
  );
  appendReviewHistorySection(
    lines,
    citationIndex,
    selectRelevantReviewEvents(reviewEvents, selectedNodeId),
    nodesById,
    directionsById
  );

  return {
    kind: 'ok',
    promptContext: lines.join('\n\n'),
    citationIndex,
  };
}

function appendProjectSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  project: Project
) {
  lines.push('## Project');
  lines.push(`Project name: ${project.name}`);

  addTextField(lines, citationIndex, {
    id: 'PROJECT:description',
    label: '프로젝트 설명',
    value: project.description,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:brief',
    label: '프로젝트 브리프',
    value: project.brief,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:constraints',
    label: '제약 조건',
    value: project.constraints,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:targetAudience',
    label: '타깃 오디언스',
    value: project.targetAudience,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:brandTone',
    label: '브랜드 톤',
    value: project.brandTone,
    entityType: 'project',
    entityId: project.id,
  });
}

function appendDirectionSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  directions: Direction[]
) {
  lines.push('## Directions');

  if (directions.length === 0) {
    lines.push('- No active directions.');
    return;
  }

  for (const direction of directions) {
    lines.push(`### Direction ${direction.name}`);

    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:name`,
      label: `${direction.name} 이름`,
      value: direction.name,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:thesis`,
      label: `${direction.name} 방향 가설`,
      value: direction.thesis,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:fitCriteria`,
      label: `${direction.name} 적합 기준`,
      value: direction.fitCriteria,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:antiGoal`,
      label: `${direction.name} 피해야 할 느낌`,
      value: direction.antiGoal,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:referenceNotes`,
      label: `${direction.name} 참고 메모`,
      value: direction.referenceNotes,
      entityType: 'direction',
      entityId: direction.id,
    });
  }
}

function appendNodesSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  nodes: Node[],
  directionsById: Record<string, Direction>
) {
  lines.push('## Nodes');

  if (nodes.length === 0) {
    lines.push('- No active nodes.');
    return;
  }

  for (const node of nodes) {
    appendNodeSection(lines, citationIndex, node, directionsById, 'Node');
  }
}

function appendNodeSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  node: Node,
  directionsById: Record<string, Direction>,
  heading: string
) {
  const nodeLabel = getNodeSequenceLabel(node);
  const directionName = node.directionId
    ? directionsById[node.directionId]?.name ?? '브랜치 없음'
    : '브랜치 없음';

  lines.push(`## ${heading} ${nodeLabel}`);

  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:summary`,
    label: `${nodeLabel} 요약`,
    value: `유형 ${node.nodeType}, 상태 ${node.status}, 브랜치 ${directionName}`,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:userIntent`,
    label: `${nodeLabel} 사용자 의도`,
    value: node.userIntent,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:prompt`,
    label: `${nodeLabel} 프롬프트`,
    value: node.resolvedPrompt ?? node.prompt,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:note`,
    label: `${nodeLabel} 메모`,
    value: node.note,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:intentTags`,
    label: `${nodeLabel} 의도 태그`,
    value: node.intentTags.join(', '),
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:changeTags`,
    label: `${nodeLabel} 변경 태그`,
    value: node.changeTags.join(', '),
    entityType: 'node',
    entityId: node.id,
  });
}

function appendLiveStagingSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  batches: CopilotLiveStagingBatch[],
  nodesById: Record<string, Node>,
  directionsById: Record<string, Direction>
) {
  lines.push('## Live Review Drafts');

  if (batches.length === 0) {
    lines.push('- No live staging batches currently in review.');
    return;
  }

  for (const batch of batches) {
    const batchLabel = buildStagingLabel(batch);
    lines.push(`### ${batchLabel}`);

    addTextField(lines, citationIndex, {
      id: `STAGING:${batch.batchId}:summary`,
      label: `${batchLabel} 요약`,
      value: buildLiveStagingSummary(batch, nodesById, directionsById),
      entityType: 'staging',
      entityId: batch.batchId,
    });
    addTextField(lines, citationIndex, {
      id: `STAGING:${batch.batchId}:prompt`,
      label: `${batchLabel} 프롬프트`,
      value: truncateContextText(batch.resolvedPrompt ?? batch.userIntent, 320),
      entityType: 'staging',
      entityId: batch.batchId,
    });
    addTextField(lines, citationIndex, {
      id: `STAGING:${batch.batchId}:selection`,
      label: `${batchLabel} 현재 선택 상태`,
      value: buildLiveSelectionSummary(batch),
      entityType: 'staging',
      entityId: batch.batchId,
    });
    addTextField(lines, citationIndex, {
      id: `STAGING:${batch.batchId}:rationaleDraft`,
      label: `${batchLabel} 검토 이유 초안`,
      value: batch.reviewDraft?.rationale
        ? `아직 저장되지 않은 초안: ${truncateContextText(
            batch.reviewDraft.rationale,
            280
          )}`
        : null,
      entityType: 'staging',
      entityId: batch.batchId,
    });
    addTextField(lines, citationIndex, {
      id: `STAGING:${batch.batchId}:metadata`,
      label: `${batchLabel} 메타데이터`,
      value: buildLiveStagingMetadata(batch),
      entityType: 'staging',
      entityId: batch.batchId,
    });
  }
}

function appendReviewHistorySection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  events: ActivityEvent[],
  nodesById: Record<string, Node>,
  directionsById: Record<string, Direction>
) {
  lines.push('## Review History');

  if (events.length === 0) {
    lines.push('- No stored review history yet.');
    return;
  }

  for (const event of events) {
    const eventLabel = buildEventLabel(event);
    const details = buildReviewEventDetails(event, nodesById, directionsById);

    lines.push(`### ${eventLabel}`);

    addTextField(lines, citationIndex, {
      id: `EVENT:${event.id}:summary`,
      label: `${eventLabel} 요약`,
      value: details.summary,
      entityType: 'activity-event',
      entityId: event.id,
    });
    addTextField(lines, citationIndex, {
      id: `EVENT:${event.id}:detail`,
      label: `${eventLabel} 세부 내용`,
      value: details.detail,
      entityType: 'activity-event',
      entityId: event.id,
    });
  }
}

function addTextField(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  field: {
    id: string;
    label: string;
    value: string | null;
    entityType: CopilotCitation['entityType'];
    entityId: string;
  }
) {
  const value = normalizeValue(field.value);

  if (!value) {
    return;
  }

  citationIndex[field.id] = {
    id: field.id,
    label: field.label,
    entityType: field.entityType,
    entityId: field.entityId,
  };

  lines.push(`- [${field.id}] ${field.label}: ${value}`);
}

function selectRelevantLiveStagingBatches(
  batches: CopilotLiveStagingBatch[],
  projectId: string,
  selectedNode: Node | null
) {
  const filtered = batches.filter((batch) => batch.projectId === projectId);

  return filtered
    .sort((left, right) => {
      const scoreDifference =
        getLiveStagingRelevanceScore(right, selectedNode) -
        getLiveStagingRelevanceScore(left, selectedNode);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return right.createdAt - left.createdAt;
    })
    .slice(0, 4);
}

function getLiveStagingRelevanceScore(
  batch: CopilotLiveStagingBatch,
  selectedNode: Node | null
) {
  if (!selectedNode) {
    return 0;
  }

  let score = 0;

  if (batch.parentNodeId === selectedNode.id) {
    score += 4;
  }

  if (batch.directionId && batch.directionId === selectedNode.directionId) {
    score += 2;
  }

  if (batch.reviewDraft?.rationale?.trim()) {
    score += 1;
  }

  return score;
}

function selectRelevantReviewEvents(
  events: ActivityEvent[],
  selectedNodeId: string | null
) {
  if (!selectedNodeId) {
    return events.slice(0, 8);
  }

  const relatedEvents = events.filter((event) =>
    eventMatchesNode(event, selectedNodeId)
  );

  return (relatedEvents.length > 0 ? relatedEvents : events).slice(0, 8);
}

function buildLiveStagingSummary(
  batch: CopilotLiveStagingBatch,
  nodesById: Record<string, Node>,
  directionsById: Record<string, Direction>
) {
  const parentNode = batch.parentNodeId ? nodesById[batch.parentNodeId] ?? null : null;
  const direction = batch.directionId ? directionsById[batch.directionId] ?? null : null;

  return compactJoin([
    `생성 유형 ${getStagingSourceLabel(batch.sourceKind)}`,
    batch.variationMode ? `편집 모드 ${getVariationModeLabel(batch.variationMode)}` : null,
    parentNode ? `기준 노드 ${getNodeSequenceLabel(parentNode)}` : null,
    direction ? `브랜치 ${direction.name}` : null,
    batch.modelLabel ? `모델 ${batch.modelLabel}` : null,
    batch.aspectRatio ? `비율 ${batch.aspectRatio}` : null,
    `후보 ${batch.candidates.length}개`,
  ]);
}

function buildLiveSelectionSummary(batch: CopilotLiveStagingBatch) {
  if (!batch.reviewDraft) {
    return `아직 확정되지 않은 후보: ${formatCandidateIndices(
      batch.candidates.map((candidate) => candidate.index)
    )}`;
  }

  const selectedIds = new Set(batch.reviewDraft.selectedCandidateIds);
  const selectedIndices = batch.candidates
    .filter((candidate) => selectedIds.has(candidate.id))
    .map((candidate) => candidate.index);
  const discardedIndices = batch.candidates
    .filter((candidate) => !selectedIds.has(candidate.id))
    .map((candidate) => candidate.index);

  return compactJoin([
    selectedIndices.length > 0
      ? `채택 초안 ${formatCandidateIndices(selectedIndices)}`
      : '채택 초안 없음',
    discardedIndices.length > 0
      ? `제외 초안 ${formatCandidateIndices(discardedIndices)}`
      : null,
  ]);
}

function buildLiveStagingMetadata(batch: CopilotLiveStagingBatch) {
  const metadataParts = [
    batch.promptSource ? `프롬프트 출처 ${batch.promptSource}` : null,
    batch.hasSourceImage ? 'source image 사용' : null,
    batch.hasMaskImage ? 'mask 사용' : null,
    batch.intentTags.length > 0 ? `의도 태그 ${batch.intentTags.join(', ')}` : null,
    batch.changeTags.length > 0 ? `변경 태그 ${batch.changeTags.join(', ')}` : null,
    batch.note ? `메모 ${truncateContextText(batch.note, 160)}` : null,
  ];

  return compactJoin(metadataParts);
}

function buildReviewEventDetails(
  event: ActivityEvent,
  nodesById: Record<string, Node>,
  directionsById: Record<string, Direction>
) {
  switch (event.kind) {
    case 'comparison-recorded':
      return buildComparisonEventDetails(event, nodesById, directionsById);
    case 'feedback-recorded':
      return buildFeedbackEventDetails(event, nodesById);
    case 'decision-recorded':
      return buildDecisionEventDetails(event, nodesById);
    default:
      return {
        summary: event.summary ?? event.kind,
        detail: null,
      };
  }
}

function buildComparisonEventDetails(
  event: ActivityEvent,
  nodesById: Record<string, Node>,
  directionsById: Record<string, Direction>
) {
  const payload = getPayloadObject(event.payload);
  const directionId = getString(payload, 'directionId');
  const directionName =
    (directionId ? directionsById[directionId]?.name : null) ?? null;
  const parentNodeId = getString(payload, 'parentNodeId');
  const parentNode =
    parentNodeId && nodesById[parentNodeId]
      ? getNodeSequenceLabel(nodesById[parentNodeId])
      : null;
  const acceptedNodeIds = getStringArray(payload, 'acceptedNodeIds');
  const rejectedCandidateIds = getStringArray(payload, 'rejectedCandidateIds');
  const discardedCandidateIds = getStringArray(payload, 'discardedCandidateIds');
  const sourceKind = getString(payload, 'sourceKind');
  const variationMode = getString(payload, 'variationMode');

  return {
    summary: compactJoin([
      sourceKind ? `비교 유형 ${getStagingSourceLabel(sourceKind)}` : null,
      variationMode ? `편집 모드 ${getVariationModeLabel(variationMode)}` : null,
      parentNode ? `기준 노드 ${parentNode}` : null,
      directionName ? `브랜치 ${directionName}` : null,
      acceptedNodeIds.length > 0 ? `채택 ${acceptedNodeIds.length}개` : null,
      rejectedCandidateIds.length > 0
        ? `비채택 ${rejectedCandidateIds.length}개`
        : null,
      discardedCandidateIds.length > 0
        ? `사전 제외 ${discardedCandidateIds.length}개`
        : null,
    ]),
    detail: compactJoin([
      getString(payload, 'resolvedPrompt')
        ? `프롬프트 ${truncateContextText(getString(payload, 'resolvedPrompt'), 220)}`
        : null,
      getString(payload, 'userIntent')
        ? `사용자 의도 ${truncateContextText(getString(payload, 'userIntent'), 180)}`
        : null,
      getString(payload, 'rationale')
        ? `채택 이유 ${truncateContextText(getString(payload, 'rationale'), 240)}`
        : null,
    ]),
  };
}

function buildFeedbackEventDetails(
  event: ActivityEvent,
  nodesById: Record<string, Node>
) {
  const payload = getPayloadObject(event.payload);
  const nodeId = getString(payload, 'nodeId');
  const nodeLabel =
    (nodeId ? getNodeLabel(nodesById[nodeId] ?? null) : null) ??
    getString(payload, 'nodeLabel');
  const sourceLabel = getString(payload, 'sourceLabel') ?? event.actorLabel;
  const dimensions = getStringArray(payload, 'dimensions');

  return {
    summary: compactJoin([
      nodeLabel ? `대상 ${nodeLabel}` : null,
      sourceLabel ? `피드백 주체 ${sourceLabel}` : null,
      dimensions.length > 0 ? `관점 ${dimensions.join(', ')}` : null,
    ]),
    detail: getString(payload, 'text')
      ? `피드백 내용 ${truncateContextText(getString(payload, 'text'), 260)}`
      : null,
  };
}

function buildDecisionEventDetails(
  event: ActivityEvent,
  nodesById: Record<string, Node>
) {
  const payload = getPayloadObject(event.payload);
  const chosenNodeId = getString(payload, 'chosenNodeId');
  const chosenNodeLabel =
    (chosenNodeId ? getNodeLabel(nodesById[chosenNodeId] ?? null) : null) ??
    getString(payload, 'chosenNodeLabel');
  const candidateNodeIds = getStringArray(payload, 'candidateNodeIds');
  const decisionType = getString(payload, 'decisionType');

  return {
    summary: compactJoin([
      decisionType ? `결정 ${getDecisionTypeLabel(decisionType)}` : null,
      chosenNodeLabel ? `선택 노드 ${chosenNodeLabel}` : '선택 노드 없음',
      candidateNodeIds.length > 0 ? `비교 대상 ${candidateNodeIds.length}개` : null,
    ]),
    detail: getString(payload, 'rationale')
      ? `결정 이유 ${truncateContextText(getString(payload, 'rationale'), 240)}`
      : null,
  };
}

function buildStagingLabel(batch: CopilotLiveStagingBatch) {
  return `검토 배치 ${getShortId(batch.batchId)}`;
}

function buildEventLabel(event: ActivityEvent) {
  return `${getReviewEventKindLabel(event.kind)} ${formatContextTimestamp(event.createdAt)}`;
}

function eventMatchesNode(
  event: Pick<ActivityEvent, 'nodeId' | 'payload'>,
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
    getString(payload, 'chosenNodeId') === nodeId ||
    getString(payload, 'parentNodeId') === nodeId ||
    includesString(getStringArray(payload, 'relatedNodeIds'), nodeId) ||
    includesString(getStringArray(payload, 'candidateNodeIds'), nodeId) ||
    includesString(getStringArray(payload, 'rejectedNodeIds'), nodeId) ||
    includesString(getStringArray(payload, 'acceptedNodeIds'), nodeId) ||
    includesObjectString(getArray(payload, 'acceptedNodes'), 'nodeId', nodeId)
  );
}

function getPayloadObject(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
}

function getArray(payload: Record<string, unknown> | null, key: string) {
  if (!payload) {
    return [];
  }

  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function getString(payload: Record<string, unknown> | null, key: string) {
  if (!payload) {
    return null;
  }

  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function getStringArray(payload: Record<string, unknown> | null, key: string) {
  return getArray(payload, key)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesString(values: string[], target: string) {
  return values.includes(target);
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

function getNodeLabel(node: Node | null) {
  return node ? getNodeSequenceLabel(node) : null;
}

function getReviewEventKindLabel(kind: ActivityEvent['kind']) {
  switch (kind) {
    case 'comparison-recorded':
      return '비교 기록';
    case 'feedback-recorded':
      return '피드백 기록';
    case 'decision-recorded':
      return '결정 기록';
    default:
      return kind;
  }
}

function getDecisionTypeLabel(decisionType: string) {
  switch (decisionType) {
    case 'final-selection':
      return '최종안 선택';
    case 'promising-selection':
      return '유망안 유지';
    case 'hold':
      return '보류';
    case 'drop':
      return '제외';
    default:
      return decisionType;
  }
}

function getStagingSourceLabel(sourceKind: string) {
  switch (sourceKind) {
    case 'variation-panel':
      return '변형 생성';
    case 'generate-dialog':
      return '기본 생성';
    default:
      return sourceKind;
  }
}

function getVariationModeLabel(variationMode: string) {
  switch (variationMode) {
    case 'prompt-only':
      return '프롬프트 변형';
    case 'image-to-image':
      return '이미지 투 이미지';
    case 'inpaint':
      return '인페인트';
    default:
      return variationMode;
  }
}

function formatCandidateIndices(indices: number[]) {
  if (indices.length === 0) {
    return '없음';
  }

  return indices
    .map((index) => `#${index + 1}`)
    .join(', ');
}

function formatContextTimestamp(value: Date) {
  return value.toISOString().replace('T', ' ').slice(0, 16);
}

function truncateContextText(value: string | null, maxLength: number) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}

function compactJoin(parts: Array<string | null>) {
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : null;
}

function getShortId(value: string) {
  return value.slice(-6);
}

function normalizeValue(value: string | null) {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}
