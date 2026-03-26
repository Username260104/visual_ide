import { NextRequest, NextResponse } from 'next/server';
import {
  buildGenerationInput,
  persistGeneratedImages,
  runReplicateGeneration,
} from '@/lib/imageGeneration';
import { buildVariationPrompt } from '@/lib/promptGeneration';
import {
  createReplicateClient,
  getReplicateErrorMessage,
} from '@/lib/replicate';

export async function POST(request: NextRequest) {
  try {
    const replicate = createReplicateClient();
    const {
      parentPrompt,
      intentTags,
      changeTags,
      note,
      numOutputs = 2,
      projectId,
      replicateId = 'black-forest-labs/flux-schnell',
      aspectRatio = '1:1',
      customWidth,
      customHeight,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const resolvedPrompt = await buildVariationPrompt({
      parentPrompt,
      intentTags,
      changeTags,
      note,
    });

    const input = buildGenerationInput({
      prompt: resolvedPrompt,
      aspectRatio,
      customWidth,
      customHeight,
    });

    const allResults = await runReplicateGeneration({
      replicate,
      replicateId,
      numOutputs,
      input,
      maxOutputs: 4,
    });

    if (!allResults || allResults.length === 0) {
      return NextResponse.json({ error: 'No images generated' }, { status: 500 });
    }

    const imageUrls = await persistGeneratedImages(projectId, allResults);

    return NextResponse.json({ imageUrls, resolvedPrompt });
  } catch (error) {
    console.error('Variation generation error:', error);
    const message = getReplicateErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
