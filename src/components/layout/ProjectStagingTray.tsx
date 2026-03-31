'use client';

import { useMemo, useState } from 'react';
import { fetchJson, indexById } from '@/lib/clientApi';
import type {
  NodeData,
  StagingBatch,
  StagingCandidate,
  StagingReviewDraft,
} from '@/lib/types';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { ModalShell } from '@/components/ui/ModalShell';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { useUIStore } from '@/stores/uiStore';
import { StagingWarningDialog } from '@/components/staging/StagingWarningDialog';

interface AcceptBatchResponse {
  nodes: NodeData[];
  comparisonEventId: string;
}

export function StagingTray() {
  const projectId = useNodeStore((state) => state.projectId);
  const batches = useStagingStore((state) => state.batches);
  const reviewDrafts = useStagingStore((state) => state.reviewDrafts);
  const isTrayOpen = useStagingStore((state) => state.isTrayOpen);
  const setTrayOpen = useStagingStore((state) => state.setTrayOpen);
  const ensureReviewDraft = useStagingStore((state) => state.ensureReviewDraft);
  const setReviewDraftRationale = useStagingStore(
    (state) => state.setReviewDraftRationale
  );
  const toggleReviewDraftCandidateSelection = useStagingStore(
    (state) => state.toggleReviewDraftCandidateSelection
  );
  const selectAllReviewDraftCandidates = useStagingStore(
    (state) => state.selectAllReviewDraftCandidates
  );
  const clearReviewDraftSelection = useStagingStore(
    (state) => state.clearReviewDraftSelection
  );
  const discardBatch = useStagingStore((state) => state.discardBatch);
  const clearBatch = useStagingStore((state) => state.clearBatch);
  const selectNode = useUIStore((state) => state.selectNode);
  const setDetailMode = useUIStore((state) => state.setDetailMode);
  const startSaveFeedback = useUIStore((state) => state.startSaveFeedback);
  const markSaveFeedbackSuccess = useUIStore(
    (state) => state.markSaveFeedbackSuccess
  );
  const markSaveFeedbackError = useUIStore(
    (state) => state.markSaveFeedbackError
  );
  const projectBatches = useMemo(
    () =>
      projectId
        ? batches.filter(
            (batch) =>
              batch.projectId === projectId &&
              batch.candidates.some((candidate) => candidate.status === 'staged')
          )
        : [],
    [batches, projectId]
  );
  const stagedCandidateCount = useMemo(
    () =>
      projectBatches.reduce(
        (count, batch) => count + getStagedCandidates(batch).length,
        0
      ),
    [projectBatches]
  );
  const [pendingDiscardBatchId, setPendingDiscardBatchId] = useState<string | null>(
    null
  );
  const [isCloseWarningOpen, setIsCloseWarningOpen] = useState(false);
  const [acceptTargetBatchId, setAcceptTargetBatchId] = useState<string | null>(
    null
  );
  const [acceptError, setAcceptError] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const pendingDiscardBatch = useMemo(
    () =>
      pendingDiscardBatchId
        ? projectBatches.find((batch) => batch.id === pendingDiscardBatchId) ?? null
        : null,
    [pendingDiscardBatchId, projectBatches]
  );
  const acceptTargetBatch = useMemo(
    () =>
      acceptTargetBatchId
        ? projectBatches.find((batch) => batch.id === acceptTargetBatchId) ?? null
        : null,
    [acceptTargetBatchId, projectBatches]
  );

  if (projectBatches.length === 0) {
    return null;
  }

  const handleOpenAccept = (batchId: string) => {
    ensureReviewDraft(batchId);
    setAcceptTargetBatchId(batchId);
    setAcceptError('');
  };

  const handleCloseAccept = () => {
    if (isAccepting) {
      return;
    }

    setAcceptTargetBatchId(null);
    setAcceptError('');
  };

  const handleAccept = async (
    draftBatch: StagingBatch,
    acceptedCandidateIds: string[]
  ) => {
    if (!projectId || isAccepting) {
      return;
    }

    if (acceptedCandidateIds.length === 0) {
      setAcceptError('채택할 후보를 하나 이상 선택해 주세요.');
      return;
    }

    const trimmedRationale = (reviewDrafts[draftBatch.id]?.rationale ?? '').trim();
    if (!trimmedRationale) {
      setAcceptError('왜 이 후보를 채택했는지 짧게라도 남겨 주세요.');
      return;
    }

    const feedbackKey = startSaveFeedback({
      entityType: 'staging',
      entityId: draftBatch.id,
      action: 'accept',
      message: '선택한 후보를 노드로 채택하는 중...',
    });

    setIsAccepting(true);
    setAcceptError('');

    try {
      const result = await fetchJson<AcceptBatchResponse>(
        `/api/projects/${projectId}/staging/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch: draftBatch,
            acceptedCandidateIds,
            rationale: trimmedRationale,
          }),
        }
      );

      useNodeStore.setState((state) => ({
        nodes: {
          ...state.nodes,
          ...indexById(result.nodes),
        },
      }));
      clearBatch(draftBatch.id);
      markSaveFeedbackSuccess(
        feedbackKey,
        `${result.nodes.length}개의 후보를 노드로 채택했습니다.`
      );

      if (result.nodes[0]) {
        setDetailMode('view');
        selectNode(result.nodes[0].id);
      }

      setAcceptTargetBatchId(null);
      setAcceptError('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '검토 대기 후보를 채택하지 못했습니다.';

      setAcceptError(message);
      markSaveFeedbackError(feedbackKey, message);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <>
      {isTrayOpen ? (
        <section
          className="shrink-0 border-t px-3 py-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                검토함
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {projectBatches.length}개 결과 묶음, {stagedCandidateCount}개 후보 이미지가 아직
                캔버스에 반영되지 않았습니다.
              </p>
            </div>

            <button
              className="rounded px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
              onClick={() => {
                if (stagedCandidateCount > 0) {
                  setIsCloseWarningOpen(true);
                  return;
                }

                setTrayOpen(false);
              }}
            >
              접기
            </button>
          </div>

          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {projectBatches.map((batch) => (
              <StagingBatchCard
                key={batch.id}
                batch={batch}
                onDiscardBatch={() => setPendingDiscardBatchId(batch.id)}
                onOpenAccept={() => handleOpenAccept(batch.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-t px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-active)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            검토 대기 결과 {projectBatches.length}개 묶음 / {stagedCandidateCount}개 후보 이미지
            대기 중
          </div>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--text-accent)',
            }}
            onClick={() => setTrayOpen(true)}
          >
            열기
          </button>
        </div>
      )}

      <AcceptBatchDialog
        batch={acceptTargetBatch}
        reviewDraft={
          acceptTargetBatch ? reviewDrafts[acceptTargetBatch.id] ?? null : null
        }
        error={acceptError}
        isSubmitting={isAccepting}
        onChangeRationale={(value) => {
          if (acceptTargetBatch) {
            setReviewDraftRationale(acceptTargetBatch.id, value);
          }
          if (acceptError) {
            setAcceptError('');
          }
        }}
        onToggleCandidateSelection={(candidateId) => {
          if (acceptTargetBatch) {
            toggleReviewDraftCandidateSelection(acceptTargetBatch.id, candidateId);
          }
          if (acceptError) {
            setAcceptError('');
          }
        }}
        onSelectAllCandidates={() => {
          if (acceptTargetBatch) {
            selectAllReviewDraftCandidates(acceptTargetBatch.id);
          }
          if (acceptError) {
            setAcceptError('');
          }
        }}
        onClearSelectedCandidates={() => {
          if (acceptTargetBatch) {
            clearReviewDraftSelection(acceptTargetBatch.id);
          }
          if (acceptError) {
            setAcceptError('');
          }
        }}
        onClearError={() => {
          if (acceptError) {
            setAcceptError('');
          }
        }}
        onClose={handleCloseAccept}
        onConfirm={(draftBatch, acceptedCandidateIds) =>
          void handleAccept(draftBatch, acceptedCandidateIds)
        }
      />

      <DestructiveActionDialog
        isOpen={pendingDiscardBatch !== null}
        title="이 결과 묶음을 제외할까요?"
        description="아직 채택하지 않은 후보가 검토함에서 제거됩니다."
        confirmLabel="묶음 제외"
        impacts={[
          pendingDiscardBatch
            ? `${getStagedCandidates(pendingDiscardBatch).length}개의 후보 이미지가 제거됩니다`
            : '선택한 결과 묶음이 제거됩니다',
        ]}
        consequences={[
          '캔버스에는 아무 노드도 생성되지 않습니다.',
          '이 작업은 현재 세션의 임시 검토 결과에만 적용됩니다.',
        ]}
        onClose={() => setPendingDiscardBatchId(null)}
        onConfirm={() => {
          if (pendingDiscardBatch) {
            discardBatch(pendingDiscardBatch.id);
          }
          setPendingDiscardBatchId(null);
        }}
      />

      <StagingWarningDialog
        isOpen={isCloseWarningOpen}
        title="검토함을 접을까요?"
        description="후보가 사라지지는 않지만, 아직 채택 전 상태라 나중에 놓치기 쉬울 수 있습니다."
        confirmLabel="접기"
        impacts={
          stagedCandidateCount > 0
            ? [`현재 프로젝트에 검토 대기 후보 ${stagedCandidateCount}개가 남아 있습니다.`]
            : []
        }
        consequences={[
          '후보는 삭제되지 않고 하단 요약 바에 그대로 남습니다.',
          '원할 때 다시 열어 비교 후 채택하거나 제외할 수 있습니다.',
        ]}
        onClose={() => setIsCloseWarningOpen(false)}
        onConfirm={() => {
          setTrayOpen(false);
          setIsCloseWarningOpen(false);
        }}
      />
    </>
  );
}

function StagingBatchCard({
  batch,
  onDiscardBatch,
  onOpenAccept,
}: {
  batch: StagingBatch;
  onDiscardBatch: () => void;
  onOpenAccept: () => void;
}) {
  const activeCandidates = getStagedCandidates(batch);
  const discardedCount = getDiscardedCandidates(batch).length;
  const summary = batch.userIntent ?? batch.resolvedPrompt ?? '요약 없음';
  const sourceLabel =
    batch.sourceKind === 'variation-panel' ? '변형 생성' : '기본 생성';

  return (
    <article
      className="flex w-[360px] shrink-0 flex-col gap-3 rounded-lg border p-3"
      style={{
        backgroundColor: 'var(--bg-active)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-1 text-[10px] font-semibold"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--text-accent)',
              }}
            >
              {sourceLabel}
            </span>
            {batch.modelLabel && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {batch.modelLabel}
              </span>
            )}
            {batch.aspectRatio && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {batch.aspectRatio}
              </span>
            )}
          </div>

          <p
            className="mt-2 line-clamp-2 text-xs"
            style={{ color: 'var(--text-primary)' }}
          >
            {summary}
          </p>
        </div>

        <button
          className="rounded px-2 py-1 text-[11px]"
          style={{
            color: 'var(--status-dropped)',
            border: '1px solid var(--border-default)',
          }}
          onClick={onDiscardBatch}
        >
          묶음 제외
        </button>
      </div>

      <div
        className="rounded border px-2.5 py-2 text-[11px]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
      >
        현재 후보 {activeCandidates.length}개
        {discardedCount > 0 && ` / 제외 ${discardedCount}개`}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {activeCandidates.map((candidate) => (
          <TrayCandidatePreviewCard key={candidate.id} candidate={candidate} />
        ))}
      </div>

      <button
        className="rounded px-2.5 py-1.5 text-[11px] font-semibold"
        style={{
          backgroundColor:
            activeCandidates.length > 0 ? 'var(--accent-primary)' : 'var(--bg-surface)',
          color:
            activeCandidates.length > 0 ? 'var(--text-inverse)' : 'var(--text-muted)',
          border: '1px solid var(--border-default)',
          opacity: activeCandidates.length > 0 ? 1 : 0.45,
        }}
        onClick={onOpenAccept}
        disabled={activeCandidates.length === 0}
      >
        비교 후 채택
      </button>

      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        후보 선택과 제외는 큰 비교 모달에서 진행합니다.
      </p>
    </article>
  );
}

function AcceptBatchDialog({
  batch,
  reviewDraft,
  error,
  isSubmitting,
  onChangeRationale,
  onToggleCandidateSelection,
  onSelectAllCandidates,
  onClearSelectedCandidates,
  onClearError,
  onClose,
  onConfirm,
}: {
  batch: StagingBatch | null;
  reviewDraft: StagingReviewDraft | null;
  error: string;
  isSubmitting: boolean;
  onChangeRationale: (value: string) => void;
  onToggleCandidateSelection: (candidateId: string) => void;
  onSelectAllCandidates: () => void;
  onClearSelectedCandidates: () => void;
  onClearError: () => void;
  onClose: () => void;
  onConfirm: (batch: StagingBatch, acceptedCandidateIds: string[]) => void;
}) {
  if (!batch) {
    return null;
  }

  const sourceLabel =
    batch.sourceKind === 'variation-panel' ? '변형 비교' : '생성 비교';
  const selectedCandidateIds = new Set(
    (reviewDraft?.selectedCandidateIds ?? getDefaultSelectedCandidateIds(batch)).filter(
      (candidateId) => batch.candidates.some((candidate) => candidate.id === candidateId)
    )
  );
  const comparisonCandidates = batch.candidates.map(
    (candidate): StagingCandidate => ({
      ...candidate,
      selected: selectedCandidateIds.has(candidate.id),
    })
  );
  const acceptedCandidates = comparisonCandidates.filter((candidate) => candidate.selected);
  const discardedCandidates = comparisonCandidates.filter((candidate) => !candidate.selected);
  const allCandidatesSelected =
    comparisonCandidates.length > 0 &&
    acceptedCandidates.length === comparisonCandidates.length;

  const handleConfirm = () => {
    const normalizedCandidates: StagingCandidate[] = comparisonCandidates.map(
      (candidate): StagingCandidate => ({
        ...candidate,
        status: candidate.selected ? 'staged' : 'discarded',
      })
    );

    onConfirm(
      {
        ...batch,
        candidates: normalizedCandidates,
      },
      acceptedCandidates.map((candidate) => candidate.id)
    );
  };

  return (
    <ModalShell
      onClose={onClose}
      closeDisabled={isSubmitting}
      panelClassName="flex max-h-[92vh] w-[min(1280px,96vw)] flex-col gap-4 overflow-y-auto p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {sourceLabel + ' ' + '후 채택'}
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {'카드를 누르면 채택 예정과 제외 예정 사이를 바로 오갈 수 있습니다.'}
          </p>
        </div>
        <button
          className="rounded px-3 py-1.5 text-xs"
          style={getSecondaryButtonStyle()}
          onClick={onClose}
          disabled={isSubmitting}
        >
          {'닫기'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill label={'비교 후보 ' + comparisonCandidates.length + '개'} />
        <StatusPill
          label={'채택 예정 ' + acceptedCandidates.length + '개'}
          tone="accent"
        />
        <StatusPill
          label={'제외 예정 ' + discardedCandidates.length + '개'}
          tone="danger"
        />
      </div>

      <section
        className="flex flex-col gap-3 rounded-lg border p-3"
        style={{
          backgroundColor: 'var(--bg-active)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {'후보 선택'}
            </h4>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {'선택된 카드는 채택 예정, 선택을 풀면 바로 제외 예정으로 이동합니다.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: !allCandidatesSelected && comparisonCandidates.length > 0 ? 1 : 0.55,
              }}
              onClick={() => {
                onClearError();
                onSelectAllCandidates();
              }}
              disabled={allCandidatesSelected || comparisonCandidates.length === 0 || isSubmitting}
            >
              {'전체 선택'}
            </button>
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: acceptedCandidates.length > 0 ? 1 : 0.55,
              }}
              onClick={() => {
                onClearError();
                onClearSelectedCandidates();
              }}
              disabled={acceptedCandidates.length === 0 || isSubmitting}
            >
              {'선택 해제'}
            </button>
          </div>
        </div>

        {comparisonCandidates.length === 0 ? (
          <p className="rounded px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {'비교할 후보가 없습니다.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {comparisonCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onClick={() => {
                  onClearError();
                  onToggleCandidateSelection(candidate.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ComparisonColumn
          title={'채택 예정 ' + acceptedCandidates.length + '개'}
          description={'이 후보들이 노드로 생성됩니다.'}
          candidates={acceptedCandidates}
          tone="accept"
          emptyMessage={'채택 예정 후보가 없습니다.'}
        />
        <ComparisonColumn
          title={'제외 예정 ' + discardedCandidates.length + '개'}
          description={'비교에서 빠지고 보관 기록만 남깁니다.'}
          candidates={discardedCandidates}
          tone="discard"
          emptyMessage={'제외 예정 후보가 없습니다.'}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {'채택 이유'}
        </label>
        <textarea
          value={reviewDraft?.rationale ?? ''}
          onChange={(event) => onChangeRationale(event.target.value)}
          placeholder={'왜 이 후보를 채택했는지, 무엇이 더 적합했는지 남겨 주세요.'}
          rows={4}
          className="w-full resize-none rounded px-2.5 py-2 text-xs focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--status-dropped)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          className="rounded px-3 py-1.5 text-xs"
          style={getSecondaryButtonStyle()}
          onClick={onClose}
          disabled={isSubmitting}
        >
          {'취소'}
        </button>
        <button
          className="rounded px-3 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            opacity: acceptedCandidates.length > 0 && !isSubmitting ? 1 : 0.55,
          }}
          onClick={handleConfirm}
          disabled={acceptedCandidates.length === 0 || isSubmitting}
        >
          {isSubmitting
            ? '채택 중...'
            : acceptedCandidates.length + '개 후보 이미지 채택'}
        </button>
      </div>
    </ModalShell>
  );
}

function StatusPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'danger';
}) {
  return (
    <span
      className="rounded px-2.5 py-1 text-[11px]"
      style={{
        backgroundColor:
          tone === 'accent'
            ? 'var(--accent-subtle)'
            : tone === 'danger'
              ? 'rgba(244, 71, 71, 0.12)'
              : 'var(--bg-surface)',
        color:
          tone === 'accent'
            ? 'var(--text-accent)'
            : tone === 'danger'
              ? 'var(--status-dropped)'
              : 'var(--text-secondary)',
        border: '1px solid var(--border-default)',
      }}
    >
      {label}
    </span>
  );
}

function ComparisonColumn({
  title,
  description,
  candidates,
  tone,
  emptyMessage,
}: {
  title: string;
  description?: string;
  candidates: StagingCandidate[];
  tone: 'accept' | 'discard';
  emptyMessage: string;
}) {
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border p-3"
      style={{
        backgroundColor: 'var(--bg-active)',
        borderColor: getComparisonToneBorderColor(tone),
      }}
    >
      <div>
        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h4>
        {description && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className="rounded px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <PreviewCard key={candidate.id} candidate={candidate} tone={tone} />
          ))}
        </div>
      )}
    </section>
  );
}

function PreviewCard({
  candidate,
  tone,
}: {
  candidate: StagingCandidate;
  tone: 'accept' | 'discard';
}) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: getComparisonToneBorderColor(tone),
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ aspectRatio: '4 / 5', backgroundColor: 'var(--bg-base)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.imageUrl}
          alt={'candidate ' + (candidate.index + 1)}
          className="h-full w-full object-contain"
        />
      </div>
      <div
        className="flex items-center justify-between px-2 py-1 text-[10px]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{'#' + (candidate.index + 1)}</span>
        <span>{getComparisonToneLabel(tone)}</span>
      </div>
    </div>
  );
}

function TrayCandidatePreviewCard({ candidate }: { candidate: StagingCandidate }) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ aspectRatio: '4 / 5', backgroundColor: 'var(--bg-base)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.imageUrl}
          alt={'staged candidate ' + (candidate.index + 1)}
          className="h-full w-full object-contain"
        />
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'var(--text-inverse)',
          }}
        >
          {'#' + (candidate.index + 1)}
        </span>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: StagingCandidate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative overflow-hidden rounded-md border text-left transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: candidate.selected
          ? 'var(--accent-primary)'
          : 'var(--border-default)',
        boxShadow: candidate.selected
          ? '0 0 0 1px var(--accent-primary)'
          : 'none',
        opacity: candidate.selected ? 1 : 0.72,
      }}
      onClick={onClick}
    >
      <div
        className="flex items-center justify-center"
        style={{ aspectRatio: '4 / 5', backgroundColor: 'var(--bg-base)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={candidate.imageUrl}
          alt={'staged candidate ' + (candidate.index + 1)}
          className="h-full w-full object-contain"
        />
      </div>

      <span
        className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'var(--text-inverse)',
        }}
      >
        {'#' + (candidate.index + 1)}
      </span>

      <span
        className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          backgroundColor: candidate.selected
            ? 'var(--accent-primary)'
            : 'rgba(0, 0, 0, 0.55)',
          color: 'var(--text-inverse)',
        }}
      >
        {candidate.selected ? '채택' : '제외'}
      </span>
    </button>
  );
}

function getStagedCandidates(batch: StagingBatch) {
  return batch.candidates.filter((candidate) => candidate.status === 'staged');
}

function getDefaultSelectedCandidateIds(batch: StagingBatch) {
  return batch.candidates
    .filter((candidate) => candidate.status === 'staged')
    .map((candidate) => candidate.id);
}

function getDiscardedCandidates(batch: StagingBatch) {
  return batch.candidates.filter((candidate) => candidate.status === 'discarded');
}

function getComparisonToneBorderColor(tone: 'accept' | 'discard') {
  if (tone === 'accept') {
    return 'var(--accent-primary)';
  }

  return 'var(--status-dropped)';
}

function getComparisonToneLabel(tone: 'accept' | 'discard') {
  if (tone === 'accept') {
    return '채택';
  }

  return '제외';
}

function getSecondaryButtonStyle() {
  return {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
  };
}
