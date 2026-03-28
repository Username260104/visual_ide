'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchJson, indexById } from '@/lib/clientApi';
import type { NodeData, StagingBatch, StagingCandidate } from '@/lib/types';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { ModalShell } from '@/components/ui/ModalShell';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { useUIStore } from '@/stores/uiStore';
import { StagingWarningDialog } from './StagingWarningDialog';

interface AcceptBatchResponse {
  nodes: NodeData[];
  comparisonEventId: string;
}

export function StagingTray() {
  const projectId = useNodeStore((state) => state.projectId);
  const batches = useStagingStore((state) => state.batches);
  const isTrayOpen = useStagingStore((state) => state.isTrayOpen);
  const setTrayOpen = useStagingStore((state) => state.setTrayOpen);
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
  const [acceptRationale, setAcceptRationale] = useState('');
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
    setAcceptTargetBatchId(batchId);
    setAcceptRationale('');
    setAcceptError('');
  };

  const handleCloseAccept = () => {
    if (isAccepting) {
      return;
    }

    setAcceptTargetBatchId(null);
    setAcceptRationale('');
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

    const trimmedRationale = acceptRationale.trim();
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
      setAcceptRationale('');
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
        rationale={acceptRationale}
        error={acceptError}
        isSubmitting={isAccepting}
        onChangeRationale={(value) => {
          setAcceptRationale(value);
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
  rationale,
  error,
  isSubmitting,
  onChangeRationale,
  onClearError,
  onClose,
  onConfirm,
}: {
  batch: StagingBatch | null;
  rationale: string;
  error: string;
  isSubmitting: boolean;
  onChangeRationale: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onConfirm: (batch: StagingBatch, acceptedCandidateIds: string[]) => void;
}) {
  const [draftCandidates, setDraftCandidates] = useState<StagingCandidate[]>([]);

  useEffect(() => {
    if (!batch) {
      setDraftCandidates([]);
      return;
    }

    setDraftCandidates(
      batch.candidates.map((candidate) =>
        candidate.status === 'staged'
          ? { ...candidate, selected: true }
          : { ...candidate, selected: false }
      )
    );
  }, [batch]);

  if (!batch) {
    return null;
  }

  const sourceLabel =
    batch.sourceKind === 'variation-panel' ? '변형 비교' : '생성 비교';
  const stagedCandidates = draftCandidates.filter(
    (candidate) => candidate.status === 'staged'
  );
  const acceptedCandidates = stagedCandidates.filter((candidate) => candidate.selected);
  const rejectedCandidates = stagedCandidates.filter((candidate) => !candidate.selected);
  const discardedCandidates = draftCandidates.filter(
    (candidate) => candidate.status === 'discarded'
  );
  const allStagedSelected =
    stagedCandidates.length > 0 && acceptedCandidates.length === stagedCandidates.length;

  const updateDraftCandidates = (
    updater: (current: StagingCandidate[]) => StagingCandidate[]
  ) => {
    onClearError();
    setDraftCandidates((current) => updater(current));
  };

  const toggleCandidateSelection = (candidateId: string) => {
    updateDraftCandidates((current) =>
      current.map((candidate) =>
        candidate.id !== candidateId || candidate.status !== 'staged'
          ? candidate
          : { ...candidate, selected: !candidate.selected }
      )
    );
  };

  const selectAllCandidates = () => {
    updateDraftCandidates((current) =>
      current.map((candidate) =>
        candidate.status !== 'staged' ? candidate : { ...candidate, selected: true }
      )
    );
  };

  const clearSelectedCandidates = () => {
    updateDraftCandidates((current) =>
      current.map((candidate) =>
        candidate.status !== 'staged' ? candidate : { ...candidate, selected: false }
      )
    );
  };

  const discardSelectedCandidates = () => {
    updateDraftCandidates((current) =>
      current.map((candidate) =>
        candidate.status === 'staged' && candidate.selected
          ? { ...candidate, selected: false, status: 'discarded' as const }
          : candidate
      )
    );
  };

  const restoreDiscardedCandidates = () => {
    updateDraftCandidates((current) =>
      current.map((candidate) =>
        candidate.status === 'discarded'
          ? { ...candidate, selected: false, status: 'staged' as const }
          : candidate
      )
    );
  };

  const handleConfirm = () => {
    onConfirm(
      {
        ...batch,
        candidates: draftCandidates.map((candidate) => ({ ...candidate })),
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
            {sourceLabel} 후 채택
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            이 모달 안에서 후보를 고르고 제외한 뒤 최종 채택을 확정합니다.
          </p>
        </div>
        <button
          className="rounded px-3 py-1.5 text-xs"
          style={getSecondaryButtonStyle()}
          onClick={onClose}
          disabled={isSubmitting}
        >
          닫기
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill label={`비교 후보 ${stagedCandidates.length}개`} />
        <StatusPill label={`채택 예정 ${acceptedCandidates.length}개`} tone="accent" />
        <StatusPill label={`기각 예정 ${rejectedCandidates.length}개`} />
        <StatusPill label={`제외 예정 ${discardedCandidates.length}개`} tone="danger" />
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
              비교 후보 선택
            </h4>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              카드를 눌러 채택 예정에서 빼거나 다시 포함할 수 있습니다. 선택된 카드만
              채택 대상으로 남고, 선택 제외는 비교 대상에서 완전히 빠집니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: !allStagedSelected && stagedCandidates.length > 0 ? 1 : 0.55,
              }}
              onClick={selectAllCandidates}
              disabled={allStagedSelected || stagedCandidates.length === 0 || isSubmitting}
            >
              전체 선택
            </button>
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: acceptedCandidates.length > 0 ? 1 : 0.55,
              }}
              onClick={clearSelectedCandidates}
              disabled={acceptedCandidates.length === 0 || isSubmitting}
            >
              선택 해제
            </button>
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: acceptedCandidates.length > 0 ? 1 : 0.55,
                color:
                  acceptedCandidates.length > 0
                    ? 'var(--status-dropped)'
                    : 'var(--text-muted)',
              }}
              onClick={discardSelectedCandidates}
              disabled={acceptedCandidates.length === 0 || isSubmitting}
            >
              선택 제외
            </button>
            <button
              className="rounded px-2.5 py-1.5 text-[11px]"
              style={{
                ...getSecondaryButtonStyle(),
                opacity: discardedCandidates.length > 0 ? 1 : 0.55,
              }}
              onClick={restoreDiscardedCandidates}
              disabled={discardedCandidates.length === 0 || isSubmitting}
            >
              제외 복원
            </button>
          </div>
        </div>

        {stagedCandidates.length === 0 ? (
          <p className="rounded px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            현재 비교 중인 후보가 없습니다. 제외 복원으로 다시 가져올 수 있습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {stagedCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onClick={() => toggleCandidateSelection(candidate.id)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ComparisonColumn
          title={`채택 예정 ${acceptedCandidates.length}개`}
          description="이 후보들이 노드로 생성됩니다."
          candidates={acceptedCandidates}
          tone="accept"
          emptyMessage="채택 예정 후보가 없습니다."
        />
        <ComparisonColumn
          title={`기각 예정 ${rejectedCandidates.length}개`}
          description="이번 비교 로그에는 남지만 노드로 생성되지는 않습니다."
          candidates={rejectedCandidates}
          tone="reject"
          emptyMessage="기각 예정 후보가 없습니다."
        />
        <ComparisonColumn
          title={`제외 예정 ${discardedCandidates.length}개`}
          description="비교에서 제외되어 별도로 기록됩니다."
          candidates={discardedCandidates}
          tone="discard"
          emptyMessage="제외 예정 후보가 없습니다."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          채택 이유
        </label>
        <textarea
          value={rationale}
          onChange={(event) => onChangeRationale(event.target.value)}
          placeholder="왜 이 후보를 채택했는지, 무엇이 더 적합했는지 남겨 주세요."
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
          취소
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
          {isSubmitting ? '채택 중...' : `${acceptedCandidates.length}개 후보 이미지 채택`}
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
  tone: 'accept' | 'reject' | 'discard';
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
  tone: 'accept' | 'reject' | 'discard';
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
          alt={`candidate ${candidate.index + 1}`}
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
        <span>#{candidate.index + 1}</span>
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
          alt={`staged candidate ${candidate.index + 1}`}
          className="h-full w-full object-contain"
        />
        <span
          className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'var(--text-inverse)',
          }}
        >
          #{candidate.index + 1}
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
          alt={`staged candidate ${candidate.index + 1}`}
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
        #{candidate.index + 1}
      </span>

      <span
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{
          backgroundColor: candidate.selected
            ? 'var(--accent-primary)'
            : 'rgba(0, 0, 0, 0.55)',
          color: 'var(--text-inverse)',
        }}
      >
        {candidate.selected ? '✓' : ''}
      </span>
    </button>
  );
}

function getStagedCandidates(batch: StagingBatch) {
  return batch.candidates.filter((candidate) => candidate.status === 'staged');
}

function getDiscardedCandidates(batch: StagingBatch) {
  return batch.candidates.filter((candidate) => candidate.status === 'discarded');
}

function getComparisonToneBorderColor(tone: 'accept' | 'reject' | 'discard') {
  if (tone === 'accept') {
    return 'var(--accent-primary)';
  }

  if (tone === 'discard') {
    return 'var(--status-dropped)';
  }

  return 'var(--border-default)';
}

function getComparisonToneLabel(tone: 'accept' | 'reject' | 'discard') {
  if (tone === 'accept') {
    return '채택';
  }

  if (tone === 'discard') {
    return '제외';
  }

  return '기각';
}

function getSecondaryButtonStyle() {
  return {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
  };
}