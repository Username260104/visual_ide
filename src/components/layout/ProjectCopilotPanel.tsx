'use client';

import { ArrowRight } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { fetchJson } from '@/lib/clientApi';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type {
  CopilotAnswer,
  CopilotAnswerConfidence,
  CopilotClientContext,
  CopilotCitation,
  CopilotLiveStagingBatch,
  StagingBatch,
  StagingReviewDraft,
} from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { useUIStore } from '@/stores/uiStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  nodeLabel?: string | null;
  citations?: CopilotCitation[];
  missingInfo?: string[];
  confidence?: CopilotAnswerConfidence | null;
  isError?: boolean;
}

const STARTER_QUESTIONS = [
  '이 프로젝트에서 핵심 방향을 요약해줘.',
  '선택한 노드 기준으로 어떤 의도가 들어가 있는지 알려줘.',
  '브랜치 전략 사이 차이를 정리해줘.',
];

export function ProjectCopilotPanel() {
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const nodes = useNodeStore((state) => state.nodes);
  const nodeProjectId = useNodeStore((state) => state.projectId);
  const directionProjectId = useDirectionStore((state) => state.projectId);
  const stagingBatches = useStagingStore((state) => state.batches);
  const reviewDrafts = useStagingStore((state) => state.reviewDrafts);

  const projectId = nodeProjectId ?? directionProjectId;
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] ?? null : null;
  const selectedNodeLabel = selectedNode
    ? getNodeSequenceLabel(selectedNode)
    : null;
  const clientContext = useMemo(
    () => buildCopilotClientContext(projectId, stagingBatches, reviewDrafts),
    [projectId, reviewDrafts, stagingBatches]
  );

  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const requestIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = draft.trim().length > 0 && !isSubmitting && Boolean(projectId);
  const subtitle = useMemo(
    () =>
      selectedNodeLabel
        ? `${selectedNodeLabel} 노드를 함께 참고합니다.`
        : '프로젝트 입력과 현재 검토 중인 생성 결과를 바탕으로 답변합니다.',
    [selectedNodeLabel]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setDraft('');
    setIsSubmitting(false);
    setMessages(projectId ? [buildIntroMessage()] : []);
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSubmitting]);

  const submitQuestion = async (questionText: string) => {
    if (!projectId || isSubmitting) {
      return;
    }

    const question = questionText.trim();
    if (!question) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setMessages((current) => [
      ...current,
      {
        id: `user-${requestId}`,
        role: 'user',
        text: question,
        nodeLabel: selectedNodeLabel,
      },
    ]);
    setDraft('');
    setIsSubmitting(true);

    try {
      const answer = await fetchJson<CopilotAnswer>(`/api/projects/${projectId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          selectedNodeId,
          clientContext,
        }),
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${requestId}`,
          role: 'assistant',
          text: answer.answer,
          citations: answer.citations,
          missingInfo: answer.missingInfo,
          confidence: answer.confidence,
        },
      ]);
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${requestId}`,
          role: 'assistant',
          text:
            error instanceof Error && error.message.trim()
              ? error.message
              : '답변을 가져오지 못했습니다.',
          citations: [],
          missingInfo: [],
          confidence: null,
          isError: true,
        },
      ]);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        void submitQuestion(draft);
      }
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="max-w-[220px] text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          프로젝트를 불러오면 코파일럿을 사용할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="border-b px-4 py-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--sidebar-header-bg)',
        }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          프로젝트 코파일럿
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {STARTER_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full px-3 py-1.5 text-left text-[11px] transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--bg-active)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                  }}
                  onClick={() => setDraft(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {isSubmitting && <TypingBubble />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t px-3 py-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {selectedNodeLabel && (
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>기준 노드</span>
            <span
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--text-accent)',
              }}
            >
              {selectedNodeLabel}
            </span>
          </div>
        )}

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="무엇이든 물어보세요."
          className="w-full resize-none rounded px-3 py-2 text-sm focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
        />

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-10 w-10 items-center justify-center rounded transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              opacity: canSubmit ? 1 : 0.45,
            }}
            aria-label={isSubmitting ? '답변 중' : '질문하기'}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const citations = message.citations ?? [];
  const missingInfo = message.missingInfo ?? [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[92%]">
        <div
          className="rounded-2xl px-3 py-2 text-sm"
          style={
            isUser
              ? {
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                }
              : {
                  backgroundColor: message.isError
                    ? 'rgba(244, 71, 71, 0.12)'
                    : 'var(--bg-surface)',
                  color: message.isError
                    ? 'var(--feedback-error)'
                    : 'var(--text-primary)',
                  border: `1px solid var(--border-default)`,
                }
          }
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>

        {isUser && message.nodeLabel && (
          <div className="mt-1 text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>
            기준 노드 {message.nodeLabel}
          </div>
        )}

        {!isUser && !message.isError && (
          <div className="mt-2 flex flex-col gap-2">
            {message.confidence && (
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                답변 상태 {getConfidenceLabel(message.confidence)}
              </div>
            )}

            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {citations.map((citation) => (
                  <span
                    key={citation.id}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: 'var(--bg-active)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {citation.label}
                  </span>
                ))}
              </div>
            )}

            {missingInfo.length > 0 && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: 'var(--bg-active)',
                  color: 'var(--text-secondary)',
                }}
              >
                부족한 정보: {missingInfo.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-2xl px-3 py-2 text-sm"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
        }}
      >
        답변을 준비하고 있습니다...
      </div>
    </div>
  );
}

function buildIntroMessage(): ChatMessage {
  return {
    id: 'assistant-intro',
    role: 'assistant',
    text: '프로젝트 전략, 브랜치, 노드 메모와 현재 검토 중인 생성 결과를 바탕으로 답변해 드릴게요.',
    citations: [],
    missingInfo: [],
    confidence: null,
  };
}

function buildCopilotClientContext(
  projectId: string | null,
  batches: StagingBatch[],
  reviewDrafts: Record<string, StagingReviewDraft>
): CopilotClientContext | null {
  if (!projectId) {
    return null;
  }

  const liveStagingBatches: CopilotLiveStagingBatch[] = batches
    .filter((batch) => batch.projectId === projectId)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 6)
    .map((batch) => ({
      batchId: batch.id,
      projectId: batch.projectId,
      sourceKind: batch.sourceKind,
      parentNodeId: batch.parentNodeId,
      directionId: batch.directionId,
      userIntent: batch.userIntent,
      resolvedPrompt: batch.resolvedPrompt,
      promptSource: batch.promptSource ?? null,
      modelLabel: batch.modelLabel,
      aspectRatio: batch.aspectRatio,
      variationMode: batch.variationMode,
      hasSourceImage: Boolean(batch.sourceImageUrl),
      hasMaskImage: Boolean(batch.maskImageUrl),
      intentTags: [...batch.intentTags],
      changeTags: [...batch.changeTags],
      note: batch.note,
      createdAt: batch.createdAt,
      candidates: batch.candidates.map((candidate) => ({
        id: candidate.id,
        index: candidate.index,
        status: candidate.status,
      })),
      reviewDraft: reviewDrafts[batch.id]
        ? {
            batchId: reviewDrafts[batch.id].batchId,
            selectedCandidateIds: [...reviewDrafts[batch.id].selectedCandidateIds],
            rationale: reviewDrafts[batch.id].rationale,
            updatedAt: reviewDrafts[batch.id].updatedAt,
          }
        : null,
    }));

  return { liveStagingBatches };
}

function getConfidenceLabel(confidence: CopilotAnswerConfidence) {
  switch (confidence) {
    case 'grounded':
      return '근거 충분';
    case 'insufficient':
      return '정보 부족';
    case 'partial':
    default:
      return '부분 근거';
  }
}
