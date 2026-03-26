import type { Prisma } from '@/generated/prisma/client';
import type {
  ActivityEventActorType,
  ActivityEventKind,
  ActivityEventSource,
} from './types';

const STATUS_LABELS: Record<string, string> = {
  unclassified: '미분류',
  reviewing: '검토 중',
  promising: '유망',
  final: '최종',
  dropped: '드롭',
};

export interface ActivityEventWriteInput {
  projectId: string;
  nodeId?: string | null;
  directionId?: string | null;
  kind: ActivityEventKind;
  actorType?: ActivityEventActorType | null;
  actorLabel?: string | null;
  source?: ActivityEventSource;
  summary?: string | null;
  payload: Prisma.InputJsonValue;
}

export async function createActivityEvent(
  tx: Prisma.TransactionClient,
  input: ActivityEventWriteInput
) {
  return tx.activityEvent.create({
    data: {
      projectId: input.projectId,
      nodeId: input.nodeId ?? null,
      directionId: input.directionId ?? null,
      kind: input.kind,
      actorType: input.actorType ?? 'system',
      actorLabel: input.actorLabel ?? null,
      source: input.source ?? 'system',
      summary: input.summary ?? buildActivityEventSummary(input),
      payload: input.payload,
    },
  });
}

export async function createActivityEvents(
  tx: Prisma.TransactionClient,
  inputs: ActivityEventWriteInput[]
) {
  for (const input of inputs) {
    await createActivityEvent(tx, input);
  }
}

function buildActivityEventSummary(input: ActivityEventWriteInput) {
  const payload = asObject(input.payload);
  const nodeLabel = getString(payload, 'nodeLabel') ?? '이미지';
  const directionName = getString(payload, 'directionName') ?? 'Direction';
  const projectName = getString(payload, 'projectName') ?? '프로젝트';

  switch (input.kind) {
    case 'node-created':
      return `${nodeLabel} 생성`;
    case 'node-reparented':
      return `${nodeLabel} 부모 변경`;
    case 'node-status-changed': {
      const fromStatus = getStatusLabel(getString(payload, 'fromStatus'));
      const toStatus = getStatusLabel(getString(payload, 'toStatus'));

      if (fromStatus && toStatus && fromStatus !== toStatus) {
        return `${nodeLabel} 상태 변경 ${fromStatus} -> ${toStatus}`;
      }

      return `${nodeLabel} 상태 사유 수정`;
    }
    case 'node-direction-changed':
      return `${nodeLabel} 방향 변경`;
    case 'node-note-saved':
      return `${nodeLabel} 메모 저장`;
    case 'node-archived':
      return `${nodeLabel} 보관`;
    case 'node-restored':
      return `${nodeLabel} 복구`;
    case 'direction-archived':
      return `${directionName} 보관`;
    case 'direction-restored':
      return `${directionName} 복구`;
    case 'project-archived':
      return `${projectName} 보관`;
    case 'project-restored':
      return `${projectName} 복구`;
    case 'feedback-recorded':
      return buildFeedbackSummary(payload, input.actorType);
    case 'decision-recorded':
      return buildDecisionSummary(payload, nodeLabel);
    case 'comparison-recorded':
      return '비교 기록';
    case 'prompt-diff-summarized':
      return '프롬프트 변화 요약';
    case 'brief-updated':
      return '브리프 업데이트';
    case 'direction-thesis-updated':
      return '방향 가설 업데이트';
    default:
      return null;
  }
}

function buildFeedbackSummary(
  payload: Record<string, Prisma.InputJsonValue> | null,
  actorType: ActivityEventActorType | null | undefined
) {
  const sourceLabel =
    getString(payload, 'sourceLabel') ?? getActorTypeLabel(actorType);
  const text = truncateText(getString(payload, 'text'));

  if (text) {
    return `${sourceLabel} 피드백: ${text}`;
  }

  return `${sourceLabel} 피드백 기록`;
}

function buildDecisionSummary(
  payload: Record<string, Prisma.InputJsonValue> | null,
  fallbackNodeLabel: string
) {
  const nodeLabel =
    getString(payload, 'chosenNodeLabel') ??
    getString(payload, 'nodeLabel') ??
    fallbackNodeLabel;
  const decisionLabel = getDecisionTypeLabel(getString(payload, 'decisionType'));

  if (decisionLabel) {
    return `${nodeLabel} ${decisionLabel}`;
  }

  return `${nodeLabel} 의사결정 기록`;
}

function asObject(
  payload: Prisma.InputJsonValue
): Record<string, Prisma.InputJsonValue> | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return null;
  }

  return payload as Record<string, Prisma.InputJsonValue>;
}

function getString(
  payload: Record<string, Prisma.InputJsonValue> | null,
  key: string
) {
  if (!payload) {
    return null;
  }

  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function getStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return STATUS_LABELS[status] ?? status;
}

function getActorTypeLabel(actorType: ActivityEventActorType | null | undefined) {
  switch (actorType) {
    case 'client':
      return '클라이언트';
    case 'director':
      return '디렉터';
    case 'designer':
      return '디자이너';
    case 'system':
      return '시스템';
    default:
      return '기타';
  }
}

function getDecisionTypeLabel(decisionType: string | null) {
  switch (decisionType) {
    case 'final-selection':
      return '최종안 결정';
    case 'promising-selection':
      return '유망안 유지 결정';
    case 'hold':
      return '보류 결정';
    case 'drop':
      return '드롭 결정';
    default:
      return null;
  }
}

function truncateText(value: string | null, maxLength: number = 48) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
