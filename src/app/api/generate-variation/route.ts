import { NextRequest, NextResponse } from 'next/server';
import {
  buildVariationGenerationInput,
  getModelDefinition,
  persistGeneratedImageAssets,
  runReplicateGeneration,
  VARIATION_INPAINT_MODEL,
} from '@/lib/imageGeneration';
import {
  createReplicateClient,
  getReplicateErrorMessage,
} from '@/lib/replicate';
import { deleteImages, type StorageUploadResult } from '@/lib/storage';

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  let temporaryMaskImagePath: string | null = null;

  try {
    const replicate = createReplicateClient();
    const {
      prompt,
      numOutputs = 2,
      projectId,
      modelId,
      replicateId = 'black-forest-labs/flux-schnell',
      aspectRatio = '1:1',
      customWidth,
      customHeight,
      editMode = 'prompt-only',
      sourceImageUrl,
      maskImageUrl,
      maskImagePath,
    } = await request.json();
    temporaryMaskImagePath =
      typeof maskImagePath === 'string' && maskImagePath.trim()
        ? maskImagePath.trim()
        : null;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const resolvedPrompt = normalizePrompt(prompt);
    if (!resolvedPrompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    const selectedModel = getModelDefinition(modelId ?? '');
    if (
      editMode === 'image-to-image' &&
      !selectedModel.supportsImg2Img
    ) {
      return NextResponse.json(
        { error: '선택한 모델은 원본 기반 편집을 지원하지 않습니다.' },
        { status: 400 }
      );
    }

    if (
      (editMode === 'image-to-image' || editMode === 'inpaint') &&
      !sourceImageUrl
    ) {
      return NextResponse.json(
        { error: '원본 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (editMode === 'inpaint' && !maskImageUrl) {
      return NextResponse.json(
        { error: '인페인트 마스크가 필요합니다.' },
        { status: 400 }
      );
    }

    const effectiveReplicateId =
      editMode === 'inpaint'
        ? VARIATION_INPAINT_MODEL.replicateId
        : replicateId;

    const input = buildVariationGenerationInput({
      replicateId: effectiveReplicateId,
      prompt: resolvedPrompt,
      aspectRatio,
      customWidth,
      customHeight,
      editMode,
      sourceImageUrl,
      maskImageUrl,
      steps:
        editMode === 'inpaint'
          ? 28
          : undefined,
    });

    const allResults = await runReplicateGeneration({
      replicate,
      replicateId: effectiveReplicateId,
      numOutputs,
      input,
      maxOutputs: 4,
    });

    if (!allResults || allResults.length === 0) {
      return NextResponse.json({ error: 'No images generated' }, { status: 500 });
    }

    const uploads = await persistGeneratedImageAssets(projectId, allResults);
    const imageUrls = uploads.map((upload) => upload.publicUrl);
    const metadata = getSharedGeneratedMetadata(uploads);

    return NextResponse.json({
      imageUrls,
      resolvedPrompt,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.aspectRatio,
    });
  } catch (error) {
    console.error('Variation generation error:', error);
    const message = getReplicateErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      if (temporaryMaskImagePath) {
        await deleteImages([temporaryMaskImagePath]);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary variation mask:', cleanupError);
    }
  }
}

function normalizePrompt(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function getSharedGeneratedMetadata(uploads: StorageUploadResult[]) {
  const first = uploads[0];

  if (!first || !first.width || !first.height) {
    return {
      width: null,
      height: null,
      aspectRatio: null,
    };
  }

  const sameDimensions = uploads.every(
    (upload) => upload.width === first.width && upload.height === first.height
  );

  if (!sameDimensions) {
    return {
      width: null,
      height: null,
      aspectRatio: null,
    };
  }

  return {
    width: first.width,
    height: first.height,
    aspectRatio: first.aspectRatio,
  };
}
