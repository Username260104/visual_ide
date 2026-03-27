import type { NodeData, PromptSource } from './types';

export function getNodeDisplayPrompt(
  node: Pick<NodeData, 'resolvedPrompt' | 'prompt' | 'userIntent'>
) {
  return node.resolvedPrompt ?? node.prompt ?? node.userIntent ?? null;
}

export function buildVariationUserIntent(options: {
  intentTags: string[];
  changeTags: string[];
  note?: string;
}) {
  const parts = [
    options.intentTags.length > 0
      ? `의도: ${options.intentTags.join(', ')}`
      : null,
    options.changeTags.length > 0
      ? `변경 요소: ${options.changeTags.join(', ')}`
      : null,
    options.note?.trim() ? `메모: ${options.note.trim()}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : null;
}

export function getPromptSourceLabel(promptSource: PromptSource | null | undefined) {
  switch (promptSource) {
    case 'legacy':
      return '레거시 로그';
    case 'user-authored':
      return '사용자 직접 작성';
    case 'ai-improved':
      return 'AI 개선본 사용';
    case 'variation-derived':
      return '변형 생성 파생';
    default:
      return null;
  }
}
