import { NextRequest, NextResponse } from 'next/server';
import {
  buildGenerationInput,
  persistGeneratedImages,
  runReplicateGeneration,
} from '@/lib/imageGeneration';
import {
  createReplicateClient,
  getReplicateErrorMessage,
} from '@/lib/replicate';

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const replicate = createReplicateClient();
    const {
      prompt,
      numOutputs = 1,
      projectId,
      replicateId,
      aspectRatio = '1:1',
      customWidth,
      customHeight,
      guidance,
      steps,
      resolution,
    } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!replicateId) {
      return NextResponse.json({ error: 'replicateId is required' }, { status: 400 });
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

    const allResults = await runReplicateGeneration({
      replicate,
      replicateId,
      numOutputs,
      input,
    });

    if (!allResults || allResults.length === 0) {
      return NextResponse.json({ error: 'No images generated' }, { status: 500 });
    }

    const imageUrls = await persistGeneratedImages(projectId, allResults);

    return NextResponse.json({ imageUrls });
  } catch (error) {
    console.error('Image generation error:', error);
    const message = getReplicateErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
