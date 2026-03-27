'use client';

import { useMemo, useState } from 'react';
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

  const handleAccept = async () => {
    if (!projectId || !acceptTargetBatch || isAccepting) {
      return;
    }

    const acceptedCandidates = getAcceptedCandidates(acceptTargetBatch);
    if (acceptedCandidates.length === 0) {
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
      entityId: acceptTargetBatch.id,
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
            batch: acceptTargetBatch,
            acceptedCandidateIds: acceptedCandidates.map((candidate) => candidate.id),
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
      clearBatch(acceptTargetBatch.id);
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
        onChangeRationale={setAcceptRationale}
        onClose={handleCloseAccept}
        onConfirm={() => void handleAccept()}
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
  const toggleCandidateSelection = useStagingStore(
    (state) => state.toggleCandidateSelection
  );
  const selectAllCandidates = useStagingStore((state) => state.selectAllCandidates);
  const clearCandidateSelection = useStagingStore(
    (state) => state.clearCandidateSelection
  );
  const discardSelectedCandidates = useStagingStore(
    (state) => state.discardSelectedCandidates
  );
  const activeCandidates = getStagedCandidates(batch);
  const acceptedCandidates = getAcceptedCandidates(batch);
  const rejectedCount = getRejectedCandidates(batch).length;
  const selectedCount = acceptedCandidates.length;
  const summary = batch.userIntent ?? batch.resolvedPrompt ?? '요약 없음';
  const sourceLabel =
    batch.sourceKind === 'variation-panel' ? '변형 생성' : '기본 생성';
  const allSelected =
    activeCandidates.length > 0 && selectedCount === activeCandidates.length;

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
        {selectedCount > 0 && ` / 채택 예정 ${selectedCount}개`}
        {rejectedCount > 0 && ` / 기각 예정 ${rejectedCount}개`}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {activeCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onClick={() => toggleCandidateSelection(batch.id, candidate.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded px-2.5 py-1.5 text-[11px]"
          style={getSecondaryButtonStyle()}
          onClick={() =>
            allSelected
              ? clearCandidateSelection(batch.id)
              : selectAllCandidates(batch.id)
          }
        >
          {allSelected ? '선택 해제' : '전체 선택'}
        </button>

        <button
          className="rounded px-2.5 py-1.5 text-[11px]"
          style={{
            ...getSecondaryButtonStyle(),
            opacity: selectedCount > 0 ? 1 : 0.45,
            color:
              selectedCount > 0 ? 'var(--status-dropped)' : 'var(--text-muted)',
          }}
          onClick={() => discardSelectedCandidates(batch.id)}
          disabled={selectedCount === 0}
        >
          선택 제외
        </button>

        <button
          className="rounded px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            backgroundColor:
              selectedCount > 0 ? 'var(--accent-primary)' : 'var(--bg-surface)',
            color:
              selectedCount > 0 ? 'var(--text-inverse)' : 'var(--text-muted)',
            border: '1px solid var(--border-default)',
            opacity: selectedCount > 0 ? 1 : 0.45,
          }}
          onClick={onOpenAccept}
          disabled={selectedCount === 0}
        >
          비교 후 채택
        </button>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        선택한 후보만 노드로 생성됩니다. 나머지 후보는 이번 결과 묶음의 비교 로그에서
        기각으로 남고 검토함에서 정리됩니다.
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
  onClose,
  onConfirm,
}: {
  batch: StagingBatch | null;
  rationale: string;
  error: string;
  isSubmitting: boolean;
  onChangeRationale: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!batch) {
    return null;
  }

  const acceptedCandidates = getAcceptedCandidates(batch);
  const rejectedCandidates = getRejectedCandidates(batch);
  const sourceLabel =
    batch.sourceKind === 'variation-panel' ? '변형 비교' : '생성 비교';

  return (
    <ModalShell
      onClose={onClose}
      closeDisabled={isSubmitting}
      panelClassName="flex max-h-[85vh] w-[720px] flex-col gap-4 p-5"
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
            선택한 후보는 노드로 생성되고, 나머지 후보는 이번 결과 묶음에서 기각으로
            남습니다.
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonColumn
          title={`채택 후보 ${acceptedCandidates.length}개`}
          candidates={acceptedCandidates}
          tone="accept"
          emptyMessage="채택할 후보를 먼저 선택해 주세요."
        />
        <ComparisonColumn
          title={`기각 후보 ${rejectedCandidates.length}개`}
          candidates={rejectedCandidates}
          tone="reject"
          emptyMessage="기각될 후보가 없습니다."
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
          onClick={onConfirm}
          disabled={acceptedCandidates.length === 0 || isSubmitting}
        >
          {isSubmitting ? '채택 중...' : `${acceptedCandidates.length}개 후보 이미지 채택`}
        </button>
      </div>
    </ModalShell>
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
  tone: 'accept' | 'reject';
  emptyMessage: string;
}) {
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border p-3"
      style={{
        backgroundColor: 'var(--bg-active)',
        borderColor:
          tone === 'accept' ? 'var(--accent-primary)' : 'var(--border-default)',
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
        <div className="grid grid-cols-3 gap-2">
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
  tone: 'accept' | 'reject';
}) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{
        borderColor:
          tone === 'accept' ? 'var(--accent-primary)' : 'var(--border-default)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={candidate.imageUrl}
        alt={`candidate ${candidate.index + 1}`}
        className="aspect-square h-full w-full object-cover"
      />
      <div
        className="flex items-center justify-between px-2 py-1 text-[10px]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>#{candidate.index + 1}</span>
        <span>{tone === 'accept' ? '채택' : '기각'}</span>
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
        borderColor: candidate.selected
          ? 'var(--accent-primary)'
          : 'var(--border-default)',
        boxShadow: candidate.selected
          ? '0 0 0 1px var(--accent-primary)'
          : 'none',
      }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={candidate.imageUrl}
        alt={`staged candidate ${candidate.index + 1}`}
        className="aspect-square h-full w-full object-cover"
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

function getAcceptedCandidates(batch: StagingBatch) {
  return batch.candidates.filter(
    (candidate) => candidate.status === 'staged' && candidate.selected
  );
}

function getRejectedCandidates(batch: StagingBatch) {
  const acceptedIds = new Set(
    getAcceptedCandidates(batch).map((candidate) => candidate.id)
  );
  return batch.candidates.filter(
    (candidate) =>
      candidate.status === 'staged' && !acceptedIds.has(candidate.id)
  );
}

function getSecondaryButtonStyle() {
  return {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
  };
}
