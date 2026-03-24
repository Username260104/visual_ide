import { NextRequest, NextResponse } from 'next/server';
import { improveImagePrompt } from '@/lib/promptGeneration';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    const improvedPrompt = await improveImagePrompt(prompt);

    return NextResponse.json({ improvedPrompt });
  } catch (error) {
    console.error('Prompt improvement error:', error);
    return NextResponse.json(
      { error: 'Failed to improve prompt' },
      { status: 500 }
    );
  }
}
