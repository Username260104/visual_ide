import { create } from 'zustand';
import type {
  PromptSource,
  StagingBatch,
  StagingSourceKind,
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
  intentTags?: string[];
  changeTags?: string[];
  note?: string | null;
  imageUrls: string[];
}

interface StagingStore {
  batches: StagingBatch[];
  isTrayOpen: boolean;
  stageBatch: (input: StageBatchInput) => StagingBatch;
  setTrayOpen: (open: boolean) => void;
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
      batches: state.batches.flatMap((batch) => {
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
    })),

  clearBatch: (batchId) =>
    set((state) => ({
      batches: state.batches.filter((batch) => batch.id !== batchId),
    })),

  clearProjectBatches: (projectId) =>
    set((state) => ({
      batches: state.batches.filter((batch) => batch.projectId !== projectId),
    })),

  clearBatches: () => set({ batches: [] }),
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
