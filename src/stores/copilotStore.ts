'use client';

import { create } from 'zustand';
import { fetchJson } from '@/lib/clientApi';
import type {
  CopilotAnswer,
  CopilotClientContext,
  CopilotConversationMessage,
  CopilotProjectSession,
  CopilotSessionMessage,
} from '@/lib/types';

const MAX_CONVERSATION_MESSAGES = 8;

interface SubmitCopilotQuestionInput {
  projectId: string;
  question: string;
  selectedNodeId: string | null;
  selectedNodeLabel: string | null;
  clientContext: CopilotClientContext | null;
}

interface CopilotStore {
  sessionsByProjectId: Record<string, CopilotProjectSession>;
  ensureSession: (projectId: string) => void;
  clearSession: (projectId: string) => void;
  setDraft: (projectId: string, draft: string) => void;
  submitQuestion: (input: SubmitCopilotQuestionInput) => Promise<void>;
}

export const useCopilotStore = create<CopilotStore>((set, get) => ({
  sessionsByProjectId: {},

  ensureSession: (projectId) =>
    set((state) => {
      if (state.sessionsByProjectId[projectId]) {
        return state;
      }

      return {
        sessionsByProjectId: {
          ...state.sessionsByProjectId,
          [projectId]: createSession(projectId),
        },
      };
    }),

  clearSession: (projectId) =>
    set((state) => {
      if (!state.sessionsByProjectId[projectId]) {
        return state;
      }

      const nextSessions = { ...state.sessionsByProjectId };
      delete nextSessions[projectId];

      return { sessionsByProjectId: nextSessions };
    }),

  setDraft: (projectId, draft) =>
    set((state) => ({
      sessionsByProjectId: {
        ...state.sessionsByProjectId,
        [projectId]: {
          ...(state.sessionsByProjectId[projectId] ?? createSession(projectId)),
          draft,
          lastTouchedAt: Date.now(),
        },
      },
    })),

  submitQuestion: async ({
    projectId,
    question,
    selectedNodeId,
    selectedNodeLabel,
    clientContext,
  }) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    const currentSession =
      get().sessionsByProjectId[projectId] ?? createSession(projectId);
    if (currentSession.isSubmitting) {
      return;
    }

    const requestVersion = currentSession.requestVersion + 1;
    const userMessage = createUserMessage(
      trimmedQuestion,
      selectedNodeId,
      selectedNodeLabel
    );
    const conversation = buildConversationHistory(currentSession.messages);

    set((state) => ({
      sessionsByProjectId: {
        ...state.sessionsByProjectId,
        [projectId]: {
          ...(state.sessionsByProjectId[projectId] ?? currentSession),
          draft: '',
          isSubmitting: true,
          requestVersion,
          lastTouchedAt: Date.now(),
          messages: [
            ...(state.sessionsByProjectId[projectId]?.messages ??
              currentSession.messages),
            userMessage,
          ],
        },
      },
    }));

    try {
      const answer = await fetchJson<CopilotAnswer>(`/api/projects/${projectId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmedQuestion,
          selectedNodeId,
          clientContext,
          conversation,
        }),
      });

      set((state) => {
        const session = state.sessionsByProjectId[projectId];
        if (!session || session.requestVersion !== requestVersion) {
          return state;
        }

        return {
          sessionsByProjectId: {
            ...state.sessionsByProjectId,
            [projectId]: {
              ...session,
              isSubmitting: false,
              lastTouchedAt: Date.now(),
              messages: [
                ...session.messages,
                createAssistantMessage(answer),
              ],
            },
          },
        };
      });
    } catch (error) {
      set((state) => {
        const session = state.sessionsByProjectId[projectId];
        if (!session || session.requestVersion !== requestVersion) {
          return state;
        }

        return {
          sessionsByProjectId: {
            ...state.sessionsByProjectId,
            [projectId]: {
              ...session,
              isSubmitting: false,
              lastTouchedAt: Date.now(),
              messages: [
                ...session.messages,
                createAssistantErrorMessage(error),
              ],
            },
          },
        };
      });
    }
  },
}));

function createSession(projectId: string): CopilotProjectSession {
  const now = Date.now();

  return {
    projectId,
    draft: '',
    messages: [createIntroMessage(now)],
    isSubmitting: false,
    requestVersion: 0,
    lastTouchedAt: now,
  };
}

function createIntroMessage(createdAt: number): CopilotSessionMessage {
  return {
    id: 'assistant-intro',
    role: 'assistant',
    text: '프로젝트 전략, 브랜치, 노드 메모와 현재 검토 중인 생성 결과를 바탕으로 답변해 드릴게요.',
    createdAt,
    citations: [],
    missingInfo: [],
    confidence: null,
    isIntro: true,
  };
}

function createUserMessage(
  text: string,
  selectedNodeIdAtSend: string | null,
  selectedNodeLabelAtSend: string | null
): CopilotSessionMessage {
  return {
    id: createMessageId('user'),
    role: 'user',
    text,
    createdAt: Date.now(),
    selectedNodeIdAtSend,
    selectedNodeLabelAtSend,
  };
}

function createAssistantMessage(answer: CopilotAnswer): CopilotSessionMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: answer.answer,
    createdAt: Date.now(),
    citations: answer.citations,
    missingInfo: answer.missingInfo,
    confidence: answer.confidence,
  };
}

function createAssistantErrorMessage(error: unknown): CopilotSessionMessage {
  return {
    id: createMessageId('assistant-error'),
    role: 'assistant',
    text:
      error instanceof Error && error.message.trim()
        ? error.message
        : '답변을 가져오지 못했습니다.',
    createdAt: Date.now(),
    citations: [],
    missingInfo: [],
    confidence: null,
    isError: true,
  };
}

function buildConversationHistory(
  messages: CopilotSessionMessage[]
): CopilotConversationMessage[] {
  return messages
    .filter((message) => !message.isIntro && !message.isError)
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: message.text,
      selectedNodeIdAtSend: message.selectedNodeIdAtSend ?? null,
      selectedNodeLabelAtSend: message.selectedNodeLabelAtSend ?? null,
    }));
}

function createMessageId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
