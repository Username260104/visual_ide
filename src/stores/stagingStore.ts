import { create } from 'zustand';
import type {
  PromptSource,
  StagingBatch,
  StagingReviewDraft,
  StagingSourceKind,
  VariationEditMode,
} from '@/lib/types';

interface StageBatchInput {
  sourceKind: StagingSourceKind;
  projectId: string;
  parentNodeId?: string | null;
  directionId?: string | null;
  userIntent?: string | null;
  resolvedPrompt?: string | null;
  promptSource?: PromptSource | null;
  modelId?: string | null;
  modelLabel?: string | null;
  aspectRatio?: string | null;
  width?: number | null;
  height?: number | null;
  variationMode?: VariationEditMode | null;
  sourceImageUrl?: string | null;
  maskImageUrl?: string | null;
  intentTags?: string[];
  changeTags?: string[];
  note?: string | null;
  imageUrls: string[];
}

interface StagingStore {
  batches: StagingBatch[];
  reviewDrafts: Record<string, StagingReviewDraft>;
  isTrayOpen: boolean;
  stageBatch: (input: StageBatchInput) => StagingBatch;
  setTrayOpen: (open: boolean) => void;
  ensureReviewDraft: (batchId: string) => void;
  setReviewDraftRationale: (batchId: string, rationale: string) => void;
  toggleReviewDraftCandidateSelection: (
    batchId: string,
    candidateId: string
  ) => void;
  selectAllReviewDraftCandidates: (batchId: string) => void;
  clearReviewDraftSelection: (batchId: string) => void;
  clearReviewDraft: (batchId: string) => void;
  toggleCandidateSelection: (batchId: string, candidateId: string) => void;
  selectAllCandidates: (batchId: string) => void;
  clearCandidateSelection: (batchId: string) => void;
  discardSelectedCandidates: (batchId: string) => void;
  discardBatch: (batchId: string) => void;
  clearBatch: (batchId: string) => void;
  clearProjectBatches: (projectId: string) => void;
  clearBatches: () => void;
}

export const useStagingStore = create<StagingStore>((set) => ({
  batches: [],
  reviewDrafts: {},
  isTrayOpen: true,

  stageBatch: (input) => {
    const batch: StagingBatch = {
      id: createStagingId('batch'),
      sourceKind: input.sourceKind,
      projectId: input.projectId,
      parentNodeId: input.parentNodeId ?? null,
      directionId: input.directionId ?? null,
      userIntent: normalizeNullableText(input.userIntent),
      resolvedPrompt: normalizeNullableText(input.resolvedPrompt),
      promptSource: input.promptSource ?? null,
      modelId: normalizeNullableText(input.modelId),
      modelLabel: normalizeNullableText(input.modelLabel),
      aspectRatio: normalizeNullableText(input.aspectRatio),
      width: normalizeNullableNumber(input.width),
      height: normalizeNullableNumber(input.height),
      variationMode: input.variationMode ?? null,
      sourceImageUrl: normalizeNullableText(input.sourceImageUrl),
      maskImageUrl: normalizeNullableText(input.maskImageUrl),
      intentTags: [...(input.intentTags ?? [])],
      changeTags: [...(input.changeTags ?? [])],
      note: normalizeNullableText(input.note),
      createdAt: Date.now(),
      candidates: input.imageUrls.map((imageUrl, index) => ({
        id: createStagingId('candidate'),
        imageUrl,
        index,
        selected: false,
        status: 'staged',
      })),
    };

    set((state) => ({
      batches: [batch, ...state.batches],
      isTrayOpen: true,
    }));

    return batch;
  },

  setTrayOpen: (open) => set({ isTrayOpen: open }),

  ensureReviewDraft: (batchId) =>
    set((state) => {
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch || state.reviewDrafts[batchId]) {
        return state;
      }

      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [batchId]: createInitialReviewDraft(batch),
        },
      };
    }),

  setReviewDraftRationale: (batchId, rationale) =>
    set((state) => {
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch) {
        return state;
      }

      const currentDraft = getOrCreateReviewDraft(state.reviewDrafts, batch);
      if (currentDraft.rationale === rationale) {
        return state;
      }

      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [batchId]: {
            ...currentDraft,
            rationale,
            updatedAt: Date.now(),
          },
        },
      };
    }),

  toggleReviewDraftCandidateSelection: (batchId, candidateId) =>
    set((state) => {
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch || !batch.candidates.some((candidate) => candidate.id === candidateId)) {
        return state;
      }

      const currentDraft = getOrCreateReviewDraft(state.reviewDrafts, batch);
      const nextSelectedIds = currentDraft.selectedCandidateIds.includes(candidateId)
        ? currentDraft.selectedCandidateIds.filter((id) => id !== candidateId)
        : [...currentDraft.selectedCandidateIds, candidateId];

      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [batchId]: {
            ...currentDraft,
            selectedCandidateIds: normalizeCandidateIds(batch, nextSelectedIds),
            updatedAt: Date.now(),
          },
        },
      };
    }),

  selectAllReviewDraftCandidates: (batchId) =>
    set((state) => {
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch) {
        return state;
      }

      const currentDraft = getOrCreateReviewDraft(state.reviewDrafts, batch);
      const nextSelectedIds = getSelectableCandidateIds(batch);

      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [batchId]: {
            ...currentDraft,
            selectedCandidateIds: nextSelectedIds,
            updatedAt: Date.now(),
          },
        },
      };
    }),

  clearReviewDraftSelection: (batchId) =>
    set((state) => {
      const batch = state.batches.find((item) => item.id === batchId);
      if (!batch) {
        return state;
      }

      const currentDraft = getOrCreateReviewDraft(state.reviewDrafts, batch);
      if (currentDraft.selectedCandidateIds.length === 0) {
        return state;
      }

      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [batchId]: {
            ...currentDraft,
            selectedCandidateIds: [],
            updatedAt: Date.now(),
          },
        },
      };
    }),

  clearReviewDraft: (batchId) =>
    set((state) => ({
      reviewDrafts: omitReviewDraft(state.reviewDrafts, batchId),
    })),

  toggleCandidateSelection: (batchId, candidateId) =>
    set((state) => ({
      batches: state.batches.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        return {
          ...batch,
          candidates: batch.candidates.map((candidate) =>
            candidate.id !== candidateId || candidate.status !== 'staged'
              ? candidate
              : { ...candidate, selected: !candidate.selected }
          ),
        };
      }),
    })),

  selectAllCandidates: (batchId) =>
    set((state) => ({
      batches: state.batches.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        return {
          ...batch,
          candidates: batch.candidates.map((candidate) =>
            candidate.status !== 'staged'
              ? candidate
              : { ...candidate, selected: true }
          ),
        };
      }),
    })),

  clearCandidateSelection: (batchId) =>
    set((state) => ({
      batches: state.batches.map((batch) => {
        if (batch.id !== batchId) {
          return batch;
        }

        return {
          ...batch,
          candidates: batch.candidates.map((candidate) => ({
            ...candidate,
            selected: false,
          })),
        };
      }),
    })),

  discardSelectedCandidates: (batchId) =>
    set((state) => ({
      ...applyBatchMutation(state, (batch) => {
        if (batch.id !== batchId) {
          return [batch];
        }

        const nextBatch = {
          ...batch,
          candidates: batch.candidates.map((candidate) =>
            candidate.status === 'staged' && candidate.selected
              ? { ...candidate, selected: false, status: 'discarded' as const }
              : candidate
          ),
        };

        return hasVisibleCandidates(nextBatch)
          ? [nextBatch]
          : [];
      }),
    })),

  discardBatch: (batchId) =>
    set((state) => ({
      batches: state.batches.filter((batch) => batch.id !== batchId),
      reviewDrafts: omitReviewDraft(state.reviewDrafts, batchId),
    })),

  clearBatch: (batchId) =>
    set((state) => ({
      batches: state.batches.filter((batch) => batch.id !== batchId),
      reviewDrafts: omitReviewDraft(state.reviewDrafts, batchId),
    })),

  clearProjectBatches: (projectId) =>
    set((state) => {
      const removedBatchIds = state.batches
        .filter((batch) => batch.projectId === projectId)
        .map((batch) => batch.id);

      return {
        batches: state.batches.filter((batch) => batch.projectId !== projectId),
        reviewDrafts: omitReviewDrafts(state.reviewDrafts, removedBatchIds),
      };
    }),

  clearBatches: () => set({ batches: [], reviewDrafts: {} }),
}));

function createStagingId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasVisibleCandidates(batch: StagingBatch) {
  return batch.candidates.some((candidate) => candidate.status === 'staged');
}

function createInitialReviewDraft(batch: StagingBatch): StagingReviewDraft {
  return {
    batchId: batch.id,
    selectedCandidateIds: getSelectableCandidateIds(batch),
    rationale: '',
    updatedAt: Date.now(),
  };
}

function getOrCreateReviewDraft(
  reviewDrafts: Record<string, StagingReviewDraft>,
  batch: StagingBatch
) {
  const existing = reviewDrafts[batch.id];
  if (!existing) {
    return createInitialReviewDraft(batch);
  }

  return {
    ...existing,
    selectedCandidateIds: normalizeCandidateIds(batch, existing.selectedCandidateIds),
  };
}

function getSelectableCandidateIds(batch: StagingBatch) {
  return batch.candidates
    .filter((candidate) => candidate.status === 'staged')
    .map((candidate) => candidate.id);
}

function normalizeCandidateIds(batch: StagingBatch, candidateIds: string[]) {
  const selectableIds = new Set(getSelectableCandidateIds(batch));
  return Array.from(
    new Set(candidateIds.filter((candidateId) => selectableIds.has(candidateId)))
  );
}

function applyBatchMutation(
  state: Pick<StagingStore, 'batches' | 'reviewDrafts'>,
  mutate: (batch: StagingBatch) => StagingBatch[]
) {
  const nextBatches = state.batches.flatMap((batch) => mutate(batch));
  const nextReviewDrafts: Record<string, StagingReviewDraft> = {};

  nextBatches.forEach((batch) => {
    const existingDraft = state.reviewDrafts[batch.id];
    if (!existingDraft) {
      return;
    }

    nextReviewDrafts[batch.id] = {
      ...existingDraft,
      selectedCandidateIds: normalizeCandidateIds(batch, existingDraft.selectedCandidateIds),
      updatedAt: Date.now(),
    };
  });

  return {
    batches: nextBatches,
    reviewDrafts: nextReviewDrafts,
  };
}

function omitReviewDraft(
  reviewDrafts: Record<string, StagingReviewDraft>,
  batchId: string
) {
  if (!reviewDrafts[batchId]) {
    return reviewDrafts;
  }

  const nextReviewDrafts = { ...reviewDrafts };
  delete nextReviewDrafts[batchId];
  return nextReviewDrafts;
}

function omitReviewDrafts(
  reviewDrafts: Record<string, StagingReviewDraft>,
  batchIds: string[]
) {
  if (batchIds.length === 0) {
    return reviewDrafts;
  }

  const nextReviewDrafts = { ...reviewDrafts };
  batchIds.forEach((batchId) => {
    delete nextReviewDrafts[batchId];
  });
  return nextReviewDrafts;
}
