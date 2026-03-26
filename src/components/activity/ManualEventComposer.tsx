'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { fetchJson } from '@/lib/clientApi';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type {
  ActivityEventActorType,
  ActivityEventData,
  NodeData,
} from '@/lib/types';
import { ModalShell } from '@/components/ui/ModalShell';
import { useUIStore } from '@/stores/uiStore';

type DialogMode = 'feedback' | 'decision' | null;
type DecisionType = 'final-selection' | 'promising-selection' | 'hold' | 'drop';

interface ManualEventComposerProps {
  node: NodeData;
  nodes: Record<string, NodeData>;
}

const ACTOR_OPTIONS: Array<{
  value: ActivityEventActorType;
  label: string;
}> = [
  { value: 'client', label: '클라이언트' },
  { value: 'director', label: '디렉터' },
  { value: 'designer', label: '디자이너' },
  { value: 'unknown', label: '기타' },
];

const DECISION_OPTIONS: Array<{ value: DecisionType; label: string }> = [
  { value: 'final-selection', label: '최종안으로 선택' },
  { value: 'promising-selection', label: '유망안으로 유지' },
  { value: 'hold', label: '보류 및 추가 검토' },
  { value: 'drop', label: '드롭 또는 기각' },
];

export function ManualEventComposer({
  node,
  nodes,
}: ManualEventComposerProps) {
  const startSaveFeedback = useUIStore((state) => state.startSaveFeedback);
  const markSaveFeedbackSuccess = useUIStore(
    (state) => state.markSaveFeedbackSuccess
  );
  const markSaveFeedbackError = useUIStore(
    (state) => state.markSaveFeedbackError
  );

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [feedbackActorType, setFeedbackActorType] =
    useState<ActivityEventActorType>('client');
  const [feedbackActorLabel, setFeedbackActorLabel] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackDimensions, setFeedbackDimensions] = useState('');

  const [decisionActorType, setDecisionActorType] =
    useState<ActivityEventActorType>('designer');
  const [decisionActorLabel, setDecisionActorLabel] = useState('');
  const [decisionType, setDecisionType] =
    useState<DecisionType>('final-selection');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [selectedComparisonIds, setSelectedComparisonIds] = useState<string[]>(
    []
  );

  const comparisonCandidates = useMemo(
    () =>
      Object.values(nodes)
        .filter(
          (candidate) =>
            candidate.projectId === node.projectId && candidate.id !== node.id
        )
        .sort((left, right) => {
          const sameDirectionLeft = left.directionId === node.directionId ? 1 : 0;
          const sameDirectionRight =
            right.directionId === node.directionId ? 1 : 0;

          if (sameDirectionLeft !== sameDirectionRight) {
            return sameDirectionRight - sameDirectionLeft;
          }

          const leftOrder = left.nodeOrdinal ?? left.versionNumber;
          const rightOrder = right.nodeOrdinal ?? right.versionNumber;
          return rightOrder - leftOrder;
        })
        .slice(0, 8),
    [node.directionId, node.id, node.projectId, nodes]
  );

  const closeDialog = () => {
    if (isSubmitting) {
      return;
    }

    setDialogMode(null);
    setError('');
  };

  const resetFeedbackForm = () => {
    setFeedbackActorType('client');
    setFeedbackActorLabel('');
    setFeedbackText('');
    setFeedbackDimensions('');
  };

  const resetDecisionForm = () => {
    setDecisionActorType('designer');
    setDecisionActorLabel('');
    setDecisionType('final-selection');
    setDecisionRationale('');
    setSelectedComparisonIds([]);
  };

  const handleFeedbackSubmit = async () => {
    const trimmedText = feedbackText.trim();
    if (!trimmedText || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    const feedbackKey = startSaveFeedback({
      entityType: 'node',
      entityId: node.id,
      action: 'feedback',
      message: '피드백 기록 저장 중...',
    });

    try {
      await fetchJson<ActivityEventData>(`/api/projects/${node.projectId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'feedback-recorded',
          nodeId: node.id,
          directionId: node.directionId,
          actorType: feedbackActorType,
          actorLabel: feedbackActorLabel.trim() || null,
          payload: {
            nodeId: node.id,
            nodeLabel: getNodeSequenceLabel(node),
            sourceType: feedbackActorType,
            sourceLabel: feedbackActorLabel.trim() || null,
            text: trimmedText,
            dimensions: parseCommaSeparatedList(feedbackDimensions),
            relatedNodeIds: [node.id],
          },
        }),
      });

      markSaveFeedbackSuccess(feedbackKey, '피드백을 기록했습니다.');
      resetFeedbackForm();
      setDialogMode(null);
    } catch (submitError) {
      const message = getErrorMessage(
        submitError,
        '피드백을 기록하지 못했습니다.'
      );

      setError(message);
      markSaveFeedbackError(feedbackKey, message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecisionSubmit = async () => {
    const trimmedRationale = decisionRationale.trim();
    if (!trimmedRationale || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    const comparisonIds = selectedComparisonIds.filter(
      (candidateId) => candidateId !== node.id
    );
    const candidateIds = [node.id, ...comparisonIds];
    const rejectedIds =
      decisionType === 'drop' ? candidateIds : comparisonIds;

    const decisionKey = startSaveFeedback({
      entityType: 'node',
      entityId: node.id,
      action: 'decision',
      message: '의사결정 기록 저장 중...',
    });

    try {
      await fetchJson<ActivityEventData>(`/api/projects/${node.projectId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'decision-recorded',
          nodeId: node.id,
          directionId: node.directionId,
          actorType: decisionActorType,
          actorLabel: decisionActorLabel.trim() || null,
          payload: {
            nodeId: node.id,
            nodeLabel: getNodeSequenceLabel(node),
            decisionType,
            rationale: trimmedRationale,
            chosenNodeId: decisionType === 'drop' ? null : node.id,
            chosenNodeLabel:
              decisionType === 'drop' ? null : getNodeSequenceLabel(node),
            candidateNodeIds: candidateIds,
            rejectedNodeIds: rejectedIds,
            relatedNodeIds: candidateIds,
          },
        }),
      });

      markSaveFeedbackSuccess(decisionKey, '의사결정을 기록했습니다.');
      resetDecisionForm();
      setDialogMode(null);
    } catch (submitError) {
      const message = getErrorMessage(
        submitError,
        '의사결정을 기록하지 못했습니다.'
      );

      setError(message);
      markSaveFeedbackError(decisionKey, message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section
        className="flex flex-col gap-3 rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-col gap-1">
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            판단 기록
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            선택 이유와 피드백을 현재 이미지에 연결해 남깁니다.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 rounded px-3 py-2 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--text-accent)',
            }}
            onClick={() => {
              setError('');
              setDialogMode('feedback');
            }}
          >
            피드백 기록
          </button>
          <button
            className="flex-1 rounded px-3 py-2 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
            onClick={() => {
              setError('');
              setDialogMode('decision');
            }}
          >
            의사결정 기록
          </button>
        </div>
      </section>

      {dialogMode === 'feedback' && (
        <ModalShell
          onClose={closeDialog}
          closeDisabled={isSubmitting}
          panelClassName="flex w-[440px] flex-col gap-4 p-5"
        >
          <div className="flex flex-col gap-2">
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              피드백 기록
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {getNodeSequenceLabel(node)}에 대한 피드백을 남깁니다.
            </p>
          </div>

          <Field>
            <FieldLabel>피드백 출처</FieldLabel>
            <select
              value={feedbackActorType}
              onChange={(event) =>
                setFeedbackActorType(
                  event.target.value as ActivityEventActorType
                )
              }
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            >
              {ACTOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel>출처 라벨</FieldLabel>
            <input
              type="text"
              value={feedbackActorLabel}
              onChange={(event) => setFeedbackActorLabel(event.target.value)}
              placeholder="예: Client round 2"
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </Field>

          <Field>
            <FieldLabel>피드백 내용</FieldLabel>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="예: 제품 존재감은 더 필요하지만 톤은 지금 방향이 좋습니다."
              rows={5}
              className="w-full resize-none rounded px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </Field>

          <Field>
            <FieldLabel>관찰 포인트</FieldLabel>
            <input
              type="text"
              value={feedbackDimensions}
              onChange={(event) => setFeedbackDimensions(event.target.value)}
              placeholder="예: tone, product-presence, brand-fit"
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </Field>

          {error && (
            <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
              {error}
            </p>
          )}

          <DialogActions
            isSubmitting={isSubmitting}
            submitLabel="피드백 저장"
            disabled={!feedbackText.trim()}
            onClose={closeDialog}
            onSubmit={() => void handleFeedbackSubmit()}
          />
        </ModalShell>
      )}

      {dialogMode === 'decision' && (
        <ModalShell
          onClose={closeDialog}
          closeDisabled={isSubmitting}
          panelClassName="flex w-[460px] flex-col gap-4 p-5"
        >
          <div className="flex flex-col gap-2">
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              의사결정 기록
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {getNodeSequenceLabel(node)}에 대한 판단과 이유를 남깁니다.
            </p>
          </div>

          <Field>
            <FieldLabel>판단 유형</FieldLabel>
            <select
              value={decisionType}
              onChange={(event) =>
                setDecisionType(event.target.value as DecisionType)
              }
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            >
              {DECISION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel>결정 주체</FieldLabel>
            <select
              value={decisionActorType}
              onChange={(event) =>
                setDecisionActorType(
                  event.target.value as ActivityEventActorType
                )
              }
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            >
              {ACTOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel>결정 라벨</FieldLabel>
            <input
              type="text"
              value={decisionActorLabel}
              onChange={(event) => setDecisionActorLabel(event.target.value)}
              placeholder="예: CD review 1"
              className="w-full rounded px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </Field>

          <Field>
            <FieldLabel>판단 이유</FieldLabel>
            <textarea
              value={decisionRationale}
              onChange={(event) => setDecisionRationale(event.target.value)}
              placeholder="예: 제품 존재감과 카피 공간 균형이 가장 좋아 최종안으로 선택함."
              rows={5}
              className="w-full resize-none rounded px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </Field>

          <Field>
            <FieldLabel>비교 대상</FieldLabel>
            {comparisonCandidates.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                비교 대상으로 연결할 다른 이미지가 아직 없습니다.
              </p>
            ) : (
              <div
                className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border p-3"
                style={{
                  borderColor: 'var(--border-default)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                {comparisonCandidates.map((candidate) => {
                  const checked = selectedComparisonIds.includes(candidate.id);

                  return (
                    <label
                      key={candidate.id}
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedComparisonIds((current) =>
                            checked
                              ? current.filter((id) => id !== candidate.id)
                              : [...current, candidate.id]
                          )
                        }
                      />
                      <span>{getNodeSequenceLabel(candidate)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              현재 단계에서는 최근 이미지 8개까지만 비교 대상으로 연결합니다.
            </p>
          </Field>

          {error && (
            <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
              {error}
            </p>
          )}

          <DialogActions
            isSubmitting={isSubmitting}
            submitLabel="의사결정 저장"
            disabled={!decisionRationale.trim()}
            onClose={closeDialog}
            onSubmit={() => void handleDecisionSubmit()}
          />
        </ModalShell>
      )}
    </>
  );
}

function DialogActions({
  isSubmitting,
  submitLabel,
  disabled,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  submitLabel: string;
  disabled: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        className="rounded px-4 py-2 text-sm"
        style={{
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
        }}
        onClick={onClose}
        disabled={isSubmitting}
      >
        취소
      </button>
      <button
        className="rounded px-4 py-2 text-sm font-semibold"
        style={{
          backgroundColor: disabled
            ? 'var(--bg-active)'
            : 'var(--accent-primary)',
          color: 'var(--text-inverse)',
          opacity: disabled || isSubmitting ? 0.65 : 1,
        }}
        onClick={onSubmit}
        disabled={disabled || isSubmitting}
      >
        {isSubmitting ? '저장 중...' : submitLabel}
      </button>
    </div>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </label>
  );
}

const fieldStyle = {
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
} as const;

function parseCommaSeparatedList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
