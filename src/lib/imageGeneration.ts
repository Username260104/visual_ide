import type Replicate from 'replicate';
import { MODELS, MODEL_MAP, type ModelDef } from '@/lib/constants';
import { uploadImageFromStream, uploadImageFromUrl } from '@/lib/storage';

export interface BuildGenerationInputOptions {
  prompt: string;
  aspectRatio?: string;
  customWidth?: number;
  customHeight?: number;
  guidance?: number;
  steps?: number;
  resolution?: string;
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
const BATCH_MODEL_IDS = new Set([
  'black-forest-labs/flux-schnell',
  'black-forest-labs/flux-dev',
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

export function supportsBatchGeneration(replicateId: string): boolean {
  return BATCH_MODEL_IDS.has(replicateId);
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
  return Promise.all(
    outputs.map(async (output) => {
      if (output instanceof ReadableStream) {
        return uploadImageFromStream(projectId, output);
      }

      if (typeof output === 'string') {
        return uploadImageFromUrl(projectId, output);
      }

      throw new Error('Unexpected output format');
    })
  );
}

function normalizeReplicateOutput(output: unknown): ReplicateOutput[] {
  return (Array.isArray(output) ? output : [output]) as ReplicateOutput[];
}
