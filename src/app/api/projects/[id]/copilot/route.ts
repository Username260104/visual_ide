import { NextRequest, NextResponse } from 'next/server';
import { buildProjectCopilotContext } from '@/lib/copilotContext';
import { generateGeminiJson } from '@/lib/gemini';
import type {
  CopilotAnswer,
  CopilotAnswerConfidence,
  CopilotClientContext,
  CopilotConversationMessage,
  CopilotCitation,
  CopilotLiveStagingBatch,
  PromptSource,
  StagingCandidateStatus,
  StagingSourceKind,
  VariationEditMode,
} from '@/lib/types';

export const runtime = 'nodejs';

const MAX_QUESTION_LENGTH = 2000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONVERSATION_TEXT_LENGTH = 1600;
const STAGING_SOURCE_KINDS = new Set<StagingSourceKind>([
  'generate-dialog',
  'variation-panel',
]);
const STAGING_CANDIDATE_STATUSES = new Set<StagingCandidateStatus>([
  'staged',
  'accepted',
  'discarded',
]);
const PROMPT_SOURCES = new Set<PromptSource>([
  'legacy',
  'user-authored',
  'ai-improved',
  'variation-derived',
]);
const VARIATION_MODES = new Set<VariationEditMode>([
  'prompt-only',
  'image-to-image',
  'inpaint',
]);

const SYSTEM_INSTRUCTION = `You are VIDE's internal project copilot.
Answer the user's question using only the provided internal project data.
Use recent conversation only to understand continuity and references.
Treat the internal project data as the factual source of truth.
If recent conversation conflicts with or is unsupported by the current project data, say so plainly and follow the project data.
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
    const clientContext = getClientContext(body);
    const conversation = getConversation(body);

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

    if (clientContext === undefined) {
      return NextResponse.json(
        { error: 'clientContext is invalid' },
        { status: 400 }
      );
    }

    if (conversation === undefined) {
      return NextResponse.json(
        { error: 'conversation is invalid' },
        { status: 400 }
      );
    }

    const context = await buildProjectCopilotContext(
      params.id,
      selectedNodeId,
      clientContext
    );

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
      prompt: buildPrompt(question, context.promptContext, conversation),
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

function buildPrompt(
  question: string,
  promptContext: string,
  conversation: CopilotConversationMessage[] | null
) {
  const sections = [];

  if (conversation && conversation.length > 0) {
    sections.push(
      ['Recent conversation:', buildConversationPrompt(conversation)].join('\n')
    );
  }

  sections.push(['Current user question:', question].join('\n'));
  sections.push(['Internal project data:', promptContext].join('\n'));

  return sections.join('\n\n');
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

function getConversation(
  body: unknown
): CopilotConversationMessage[] | null | undefined {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const conversation = Reflect.get(body, 'conversation');

  if (conversation === undefined || conversation === null) {
    return null;
  }

  if (!Array.isArray(conversation)) {
    return undefined;
  }

  const parsedMessages = conversation.map(parseConversationMessage);
  if (parsedMessages.some((message) => message === null)) {
    return undefined;
  }

  return parsedMessages
    .filter(
      (message): message is CopilotConversationMessage => message !== null
    )
    .slice(-MAX_CONVERSATION_MESSAGES);
}

function getClientContext(body: unknown): CopilotClientContext | null | undefined {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const clientContext = Reflect.get(body, 'clientContext');

  if (clientContext === undefined || clientContext === null) {
    return null;
  }

  if (typeof clientContext !== 'object' || Array.isArray(clientContext)) {
    return undefined;
  }

  const liveStagingBatches = Reflect.get(clientContext, 'liveStagingBatches');
  if (!Array.isArray(liveStagingBatches)) {
    return undefined;
  }

  const parsedBatches = liveStagingBatches.map(parseLiveStagingBatch);
  if (parsedBatches.some((batch) => batch === null)) {
    return undefined;
  }

  return {
    liveStagingBatches: parsedBatches.filter(
      (batch): batch is CopilotLiveStagingBatch => batch !== null
    ),
  };
}

function parseLiveStagingBatch(value: unknown): CopilotLiveStagingBatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const batch = value as Record<string, unknown>;
  const batchId = getRequiredString(batch, 'batchId', 80);
  const projectId = getRequiredString(batch, 'projectId', 80);
  const sourceKind = getRequiredString(batch, 'sourceKind', 40);
  const createdAt = getRequiredNumber(batch, 'createdAt');
  const candidatesInput = Reflect.get(batch, 'candidates');

  if (
    !batchId ||
    !projectId ||
    !sourceKind ||
    !STAGING_SOURCE_KINDS.has(sourceKind as StagingSourceKind) ||
    createdAt === null ||
    !Array.isArray(candidatesInput)
  ) {
    return null;
  }

  const candidates = candidatesInput.map(parseLiveStagingCandidate);
  if (candidates.some((candidate) => candidate === null)) {
    return null;
  }

  const parsedCandidates = candidates.filter((candidate) => candidate !== null);
  const reviewDraft = parseReviewDraft(
    Reflect.get(batch, 'reviewDraft'),
    batchId,
    parsedCandidates.map((candidate) => candidate.id)
  );
  if (reviewDraft === undefined) {
    return null;
  }

  return {
    batchId,
    projectId,
    sourceKind: sourceKind as StagingSourceKind,
    parentNodeId: getOptionalString(batch, 'parentNodeId', 80),
    directionId: getOptionalString(batch, 'directionId', 80),
    userIntent: getOptionalString(batch, 'userIntent', 4000),
    resolvedPrompt: getOptionalString(batch, 'resolvedPrompt', 4000),
    promptSource: parsePromptSource(getOptionalString(batch, 'promptSource', 40)),
    modelLabel: getOptionalString(batch, 'modelLabel', 120),
    aspectRatio: getOptionalString(batch, 'aspectRatio', 40),
    variationMode: parseVariationMode(
      getOptionalString(batch, 'variationMode', 40)
    ),
    hasSourceImage: getOptionalBoolean(batch, 'hasSourceImage') ?? false,
    hasMaskImage: getOptionalBoolean(batch, 'hasMaskImage') ?? false,
    intentTags: readStringArrayWithLimit(Reflect.get(batch, 'intentTags'), 16, 80),
    changeTags: readStringArrayWithLimit(Reflect.get(batch, 'changeTags'), 16, 80),
    note: getOptionalString(batch, 'note', 2000),
    createdAt,
    candidates: parsedCandidates,
    reviewDraft,
  };
}

function parseLiveStagingCandidate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = getRequiredString(candidate, 'id', 80);
  const index = getRequiredNumber(candidate, 'index');
  const status = getRequiredString(candidate, 'status', 40);

  if (
    !id ||
    index === null ||
    !Number.isInteger(index) ||
    !status ||
    !STAGING_CANDIDATE_STATUSES.has(status as StagingCandidateStatus)
  ) {
    return null;
  }

  return {
    id,
    index,
    status: status as StagingCandidateStatus,
  };
}

function parseConversationMessage(value: unknown): CopilotConversationMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;
  const role = getRequiredString(message, 'role', 20);
  const text = getRequiredString(message, 'text', MAX_CONVERSATION_TEXT_LENGTH);

  if (!text || (role !== 'user' && role !== 'assistant')) {
    return null;
  }

  return {
    role,
    text,
    selectedNodeIdAtSend: getOptionalString(message, 'selectedNodeIdAtSend', 80),
    selectedNodeLabelAtSend: getOptionalString(
      message,
      'selectedNodeLabelAtSend',
      120
    ),
  };
}

function parseReviewDraft(
  value: unknown,
  batchId: string,
  candidateIds: string[]
) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const draft = value as Record<string, unknown>;
  const updatedAt = getRequiredNumber(draft, 'updatedAt');
  if (updatedAt === null) {
    return undefined;
  }

  const validCandidateIds = new Set(candidateIds);
  const selectedCandidateIds = readStringArrayWithLimit(
    Reflect.get(draft, 'selectedCandidateIds'),
    candidateIds.length || 16,
    80
  ).filter((candidateId) => validCandidateIds.has(candidateId));

  return {
    batchId,
    selectedCandidateIds,
    rationale: getOptionalString(draft, 'rationale', 4000) ?? '',
    updatedAt,
  };
}

function parsePromptSource(value: string | null) {
  if (!value || !PROMPT_SOURCES.has(value as PromptSource)) {
    return null;
  }

  return value as PromptSource;
}

function parseVariationMode(value: string | null) {
  if (!value || !VARIATION_MODES.has(value as VariationEditMode)) {
    return null;
  }

  return value as VariationEditMode;
}

function buildConversationPrompt(conversation: CopilotConversationMessage[]) {
  return conversation
    .map((message, index) => {
      const lines = [`${index + 1}. ${message.role.toUpperCase()}`];

      if (message.role === 'user' && message.selectedNodeLabelAtSend) {
        lines.push(`Selected node at send: ${message.selectedNodeLabelAtSend}`);
      }

      lines.push(message.text);
      return lines.join('\n');
    })
    .join('\n\n');
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

function readStringArrayWithLimit(
  value: unknown,
  maxItems: number,
  maxLength: number
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((item) => item.slice(0, maxLength))
    )
  );
}

function getRequiredString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = getOptionalString(body, key, maxLength);
  return value && value.trim() ? value : null;
}

function getOptionalString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = Reflect.get(body, key);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getRequiredNumber(body: Record<string, unknown>, key: string) {
  const value = Reflect.get(body, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getOptionalBoolean(body: Record<string, unknown>, key: string) {
  const value = Reflect.get(body, key);
  return typeof value === 'boolean' ? value : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to answer question';
}
