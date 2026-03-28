import type Replicate from 'replicate';
import { MODELS, MODEL_MAP, type ModelDef } from '@/lib/constants';
import type { VariationEditMode } from '@/lib/types';
import {
  deleteImages,
  type StorageUploadResult,
  uploadImageAssetFromStream,
  uploadImageAssetFromUrl,
} from '@/lib/storage';

export interface BuildGenerationInputOptions {
  prompt: string;
  aspectRatio?: string;
  customWidth?: number;
  customHeight?: number;
  guidance?: number;
  steps?: number;
  resolution?: string;
}

export interface BuildVariationGenerationInputOptions
  extends BuildGenerationInputOptions {
  replicateId: string;
  editMode?: VariationEditMode;
  sourceImageUrl?: string | null;
  maskImageUrl?: string | null;
  promptStrength?: number;
}

interface RunReplicateGenerationOptions {
  replicate: Replicate;
  replicateId: string;
  numOutputs: number;
  input: Record<string, unknown>;
  maxOutputs?: number;
}

interface SelectableOutputCountOptions {
  maxParallelOutputs?: number;
}

type ReplicateOutput = string | ReadableStream;

const DEFAULT_ASPECT_RATIO = '1:1';
const DEFAULT_OUTPUT_COUNTS = [1, 2, 3, 4, 6, 8];
const DEFAULT_PARALLEL_OUTPUT_COUNTS = [1, 2, 3, 4];
const MAX_BATCH_OUTPUTS = 4;
export const VARIATION_INPAINT_MODEL = {
  id: 'flux-fill-dev',
  replicateId: 'black-forest-labs/flux-fill-dev',
  name: 'FLUX Fill Dev',
} as const;
const BATCH_MODEL_IDS = new Set([
  'black-forest-labs/flux-schnell',
  'black-forest-labs/flux-dev',
  VARIATION_INPAINT_MODEL.replicateId,
]);

export function getModelDefinition(modelId: string): ModelDef {
  return MODEL_MAP[modelId] ?? MODELS[0];
}

export function getGenerationAspectRatios(
  model: ModelDef,
  { includeCustom = false }: { includeCustom?: boolean } = {}
): string[] {
  return model.aspectRatios.filter((ratio) => {
    if (ratio === 'match_input_image') return false;
    if (!includeCustom && ratio === 'custom') return false;
    return true;
  });
}

export function getDefaultAspectRatio(
  model: ModelDef,
  options?: { includeCustom?: boolean }
): string {
  const availableRatios = getGenerationAspectRatios(model, options);
  return availableRatios.find((ratio) => ratio === DEFAULT_ASPECT_RATIO)
    ?? availableRatios[0]
    ?? DEFAULT_ASPECT_RATIO;
}

export function getResolutionOptions(model: ModelDef): string[] {
  return model.resolutionOptions?.filter(
    (option) => option !== 'match_input_image'
  ) ?? [];
}

export function getDefaultResolution(model: ModelDef): string | null {
  const options = getResolutionOptions(model);
  return options[1] ?? options[0] ?? null;
}

export function getSelectableOutputCounts(
  model: ModelDef,
  { maxParallelOutputs = 4 }: SelectableOutputCountOptions = {}
): number[] {
  if (model.supportsBatch) {
    return DEFAULT_OUTPUT_COUNTS.filter((count) => count <= model.maxOutputs);
  }

  return DEFAULT_PARALLEL_OUTPUT_COUNTS.filter(
    (count) => count <= maxParallelOutputs
  );
}

export function clampOutputCount(
  requestedCount: number,
  maxOutputs = 8
): number {
  const normalizedCount = Number.isFinite(requestedCount)
    ? Math.round(requestedCount)
    : 1;

  return Math.min(maxOutputs, Math.max(1, normalizedCount));
}

export function buildGenerationInput({
  prompt,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  customWidth,
  customHeight,
  guidance,
  steps,
  resolution,
}: BuildGenerationInputOptions): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt,
    output_format: 'webp',
    output_quality: 80,
  };

  if (aspectRatio === 'custom' && customWidth && customHeight) {
    input.aspect_ratio = 'custom';
    input.width = Number(customWidth);
    input.height = Number(customHeight);
  } else {
    input.aspect_ratio = aspectRatio;
  }

  if (guidance !== undefined) input.guidance = Number(guidance);
  if (steps !== undefined) input.num_inference_steps = Number(steps);
  if (resolution !== undefined) input.resolution = resolution;

  return input;
}

export function buildVariationGenerationInput({
  prompt,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  customWidth,
  customHeight,
  guidance,
  steps,
  resolution,
  replicateId,
  editMode = 'prompt-only',
  sourceImageUrl,
  maskImageUrl,
  promptStrength,
}: BuildVariationGenerationInputOptions): Record<string, unknown> {
  if (editMode === 'inpaint') {
    if (!sourceImageUrl || !maskImageUrl) {
      throw new Error('Inpaint variation requires both source image and mask.');
    }

    return {
      prompt,
      image: sourceImageUrl,
      mask: maskImageUrl,
      output_format: 'webp',
      output_quality: 80,
      megapixels: 'match_input',
      ...(guidance !== undefined ? { guidance: Number(guidance) } : {}),
      ...(steps !== undefined
        ? { num_inference_steps: Number(steps) }
        : {}),
    };
  }

  const input = buildGenerationInput({
    prompt,
    aspectRatio,
    customWidth,
    customHeight,
    guidance,
    steps,
    resolution,
  });

  if (editMode !== 'image-to-image' || !sourceImageUrl) {
    return input;
  }

  if (replicateId === 'black-forest-labs/flux-2-pro') {
    delete input.aspect_ratio;
    delete input.width;
    delete input.height;
    delete input.resolution;

    return {
      ...input,
      input_images: [sourceImageUrl],
      aspect_ratio: 'match_input_image',
    };
  }

  delete input.aspect_ratio;
  delete input.width;
  delete input.height;

  return {
    ...input,
    image: sourceImageUrl,
    ...(promptStrength !== undefined
      ? { prompt_strength: Number(promptStrength) }
      : {}),
  };
}

export function supportsBatchGeneration(replicateId: string): boolean {
  return BATCH_MODEL_IDS.has(replicateId);
}

export function getVariationModeLabel(mode: VariationEditMode | null | undefined) {
  switch (mode) {
    case 'image-to-image':
      return '원본 기반 편집';
    case 'inpaint':
      return '인페인트';
    case 'prompt-only':
      return '프롬프트 변형';
    default:
      return null;
  }
}

export function getAspectRatioDisplayLabel(aspectRatio: string | null | undefined) {
  if (!aspectRatio) {
    return null;
  }

  return aspectRatio === 'match_input_image'
    ? '원본 비율 유지'
    : aspectRatio;
}

export async function runReplicateGeneration({
  replicate,
  replicateId,
  numOutputs,
  input,
  maxOutputs = 8,
}: RunReplicateGenerationOptions): Promise<ReplicateOutput[]> {
  const count = clampOutputCount(numOutputs, maxOutputs);
  const normalizedReplicateId = replicateId as `${string}/${string}`;

  if (supportsBatchGeneration(replicateId)) {
    const batchCount = Math.ceil(count / MAX_BATCH_OUTPUTS);
    const outputs = await Promise.all(
      Array.from({ length: batchCount }, (_, index) => {
        const remainingCount = count - index * MAX_BATCH_OUTPUTS;
        const batchSize = Math.min(MAX_BATCH_OUTPUTS, remainingCount);

        return replicate.run(normalizedReplicateId, {
          input: {
            ...input,
            num_outputs: batchSize,
          },
        });
      })
    );

    return outputs.flatMap(normalizeReplicateOutput);
  }

  const outputs = await Promise.all(
    Array.from({ length: count }, () =>
      replicate.run(normalizedReplicateId, { input })
    )
  );

  return outputs.flatMap(normalizeReplicateOutput);
}

export async function persistGeneratedImages(
  projectId: string,
  outputs: ReplicateOutput[]
): Promise<string[]> {
  const uploads = await persistGeneratedImageAssets(projectId, outputs);
  return uploads.map((upload) => upload.publicUrl);
}

export async function persistGeneratedImageAssets(
  projectId: string,
  outputs: ReplicateOutput[]
): Promise<StorageUploadResult[]> {
  const settledUploads = await Promise.allSettled(
    outputs.map((output) => persistSingleGeneratedImage(projectId, output))
  );

  const successfulUploads = settledUploads.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
  const failedUpload = settledUploads.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (failedUpload) {
    await rollbackGeneratedUploads(successfulUploads);
    throw new Error(getUploadFailureMessage(failedUpload.reason));
  }

  return successfulUploads;
}

async function persistSingleGeneratedImage(
  projectId: string,
  output: ReplicateOutput
): Promise<StorageUploadResult> {
  if (output instanceof ReadableStream) {
    return uploadImageAssetFromStream(projectId, output);
  }

  if (typeof output === 'string') {
    return uploadImageAssetFromUrl(projectId, output);
  }

  throw new Error('Unexpected output format');
}

async function rollbackGeneratedUploads(
  uploads: StorageUploadResult[]
): Promise<void> {
  if (uploads.length === 0) {
    return;
  }

  try {
    await deleteImages(uploads.map((upload) => upload.path));
  } catch (cleanupError) {
    console.error('Failed to rollback generated image uploads:', cleanupError);
    throw new Error(
      'Generated image persistence failed and uploaded files could not be cleaned up automatically.'
    );
  }
}

function getUploadFailureMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) {
    return `Failed to persist generated images: ${reason.message}`;
  }

  return 'Failed to persist generated images.';
}

function normalizeReplicateOutput(output: unknown): ReplicateOutput[] {
  return (Array.isArray(output) ? output : [output]) as ReplicateOutput[];
}
