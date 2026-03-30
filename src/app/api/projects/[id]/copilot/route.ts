import { NextRequest, NextResponse } from 'next/server';
import { buildProjectCopilotContext } from '@/lib/copilotContext';
import { generateGeminiJson } from '@/lib/gemini';
import type {
  CopilotAnswer,
  CopilotAnswerConfidence,
  CopilotCitation,
} from '@/lib/types';

export const runtime = 'nodejs';

const MAX_QUESTION_LENGTH = 2000;

const SYSTEM_INSTRUCTION = `You are VIDE's internal project copilot.
Answer the user's question using only the provided internal project data.
Do not use outside knowledge.
If the data is insufficient, say so plainly.
Keep the answer concise and practical.
Only include citation IDs that appear in the provided internal project data.`;

const COPILOT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'string',
    },
    confidence: {
      type: 'string',
      enum: ['grounded', 'partial', 'insufficient'],
    },
    citationIds: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    missingInfo: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['answer', 'confidence', 'citationIds', 'missingInfo'],
} as const;

interface CopilotModelResponse {
  answer?: unknown;
  confidence?: unknown;
  citationIds?: unknown;
  missingInfo?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const question = getQuestion(body);
    const selectedNodeId = getSelectedNodeId(body);

    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (selectedNodeId === undefined) {
      return NextResponse.json(
        { error: 'selectedNodeId must be a string or null' },
        { status: 400 }
      );
    }

    const context = await buildProjectCopilotContext(params.id, selectedNodeId);

    if (context.kind === 'project-not-found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (context.kind === 'selected-node-not-found') {
      return NextResponse.json(
        { error: 'Selected node not found' },
        { status: 400 }
      );
    }

    const rawResponse = await generateGeminiJson<CopilotModelResponse>({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(question, context.promptContext),
      responseJsonSchema: COPILOT_RESPONSE_SCHEMA,
    });

    const payload = sanitizeCopilotResponse(rawResponse, context.citationIndex);

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Project copilot error:', error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

function buildPrompt(question: string, promptContext: string) {
  return [
    'User question:',
    question,
    '',
    'Internal project data:',
    promptContext,
  ].join('\n');
}

function getQuestion(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return '';
  }

  const question = Reflect.get(body, 'question');
  return typeof question === 'string' ? question.trim() : '';
}

function getSelectedNodeId(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const selectedNodeId = Reflect.get(body, 'selectedNodeId');

  if (selectedNodeId === undefined || selectedNodeId === null) {
    return null;
  }

  if (typeof selectedNodeId !== 'string') {
    return undefined;
  }

  const trimmed = selectedNodeId.trim();
  return trimmed || null;
}

function sanitizeCopilotResponse(
  rawResponse: CopilotModelResponse,
  citationIndex: Record<string, CopilotCitation>
): CopilotAnswer {
  const answer =
    typeof rawResponse.answer === 'string' ? rawResponse.answer.trim() : '';

  if (!answer) {
    throw new Error('Gemini returned an empty answer.');
  }

  const confidence = isConfidence(rawResponse.confidence)
    ? rawResponse.confidence
    : 'partial';
  const citationIds = readStringArray(rawResponse.citationIds);
  const missingInfo = readStringArray(rawResponse.missingInfo);
  const citations = Array.from(new Set(citationIds))
    .map((id) => citationIndex[id])
    .filter(Boolean);

  return {
    answer,
    confidence,
    citations,
    missingInfo,
  };
}

function isConfidence(value: unknown): value is CopilotAnswerConfidence {
  return (
    value === 'grounded' ||
    value === 'partial' ||
    value === 'insufficient'
  );
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to answer question';
}
