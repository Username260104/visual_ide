'use client';

import { useMemo, useState } from 'react';
import {
  StrategyContextCard,
  type StrategyContextItem,
} from '@/components/context/StrategyContextCard';
import { StagingBatchPreview } from '@/components/staging/StagingBatchPreview';
import { useProjectStrategy } from '@/hooks/useProjectStrategy';
import { MODELS } from '@/lib/constants';
import { fetchJson } from '@/lib/clientApi';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { buildVariationUserIntent, getNodeDisplayPrompt } from '@/lib/promptProvenance';
import {
  getGenerationAspectRatios,
  getModelDefinition,
  getSelectableOutputCounts,
} from '@/lib/imageGeneration';
import type { NodeData } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';

interface VariationPanelProps {
  node: NodeData;
  onBack: () => void;
}

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';

const COPY = {
  back: '상세 보기로 돌아가기',
  title: '변형 만들기',
  parentVersion: '부모 버전',
  prompt: '프롬프트',
  intent: '의도',
  intentDescription: '어떤 방향으로 바꾸고 싶은지 선택해 주세요.',
  change: '변경 요소',
  changeDescription: '무엇을 수정할지 선택해 주세요.',
  note: '추가 메모',
  notePlaceholder: '원하는 변화가 있다면 구체적으로 적어 주세요.',
  model: '모델',
  ratio: '비율',
  outputCount: '생성 수량',
  requireInput: '의도 태그, 변경 태그, 메모 중 하나 이상을 입력해 주세요.',
  selectProject: '프로젝트를 먼저 선택해 주세요.',
  generating: '변형 이미지를 생성하는 중입니다...',
  generationError: '변형 생성 중 오류가 발생했습니다. 다시 시도해 주세요.',
  generatingShort: '생성 중...',
  parentRoot: ' (루트)',
} as const;

const INTENT_OPTIONS = [
  '톤 조정',
  '구도 정리',
  '분위기 변경',
  '디테일 추가',
  '스타일 변경',
  '요소 제거',
  '요소 추가',
  '비율 조정',
] as const;

const CHANGE_OPTIONS = [
  '배경',
  '조명',
  '색상',
  '인물',
  '오브젝트',
  '텍스처',
  '타이포',
  '레이아웃',
] as const;

const MODEL_DESCRIPTIONS: Record<string, string> = {
  'flux-schnell': '빠른 생성, 초안 탐색용',
  'flux-dev': '균형 잡힌 고품질 모델',
  'flux-1.1-pro': '고품질 결과, 커스텀 해상도 지원',
  'flux-2-pro': '최신 상위 모델, 최대 2048px',
  'seedream-4.5': 'ByteDance 계열, 4K 지원',
  'ideogram-v3-turbo': '텍스트와 타이포 표현에 강점',
  'recraft-v4': '브랜딩과 그래픽 스타일에 강점',
};

export function VariationPanel({ node, onBack }: VariationPanelProps) {
  const [intentTags, setIntentTags] = useState<string[]>([]);
  const [changeTags, setChangeTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [numOutputs, setNumOutputs] = useState(2);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [status, setStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const projectId = useNodeStore((state) => state.projectId);
  const stagingBatches = useStagingStore((state) => state.batches);
  const stageBatch = useStagingStore((state) => state.stageBatch);
  const direction = useDirectionStore((state) =>
    node.directionId ? state.directions[node.directionId] ?? null : null
  );
  const {
    project,
    isLoading: isProjectStrategyLoading,
    error: projectStrategyError,
  } = useProjectStrategy(projectId);
  const model = getModelDefinition(modelId);
  const parentPrompt = getNodeDisplayPrompt(node);

  const availableRatios = useMemo(
    () => getGenerationAspectRatios(model),
    [model]
  );
  const outputOptions = useMemo(
    () => getSelectableOutputCounts(model),
    [model]
  );
  const latestVariationBatch = useMemo(
    () =>
      projectId
        ? stagingBatches.find(
            (batch) =>
              batch.projectId === projectId &&
              batch.sourceKind === 'variation-panel' &&
              batch.parentNodeId === node.id
          ) ?? null
        : null,
    [node.id, projectId, stagingBatches]
  );
  const directionContextItems = useMemo<StrategyContextItem[]>(
    () => [
      { label: '방향 가설', value: direction?.thesis },
      { label: '적합 기준', value: direction?.fitCriteria },
      { label: '피해야 할 느낌', value: direction?.antiGoal },
      { label: '참고 메모', value: direction?.referenceNotes },
    ],
    [direction]
  );
  const projectContextItems = useMemo<StrategyContextItem[]>(
    () => [
      { label: '프로젝트 브리프', value: project?.brief },
      { label: '브랜드 톤', value: project?.brandTone },
      { label: '타깃 오디언스', value: project?.targetAudience },
      { label: '제약 조건', value: project?.constraints },
    ],
    [project]
  );

  const toggleTag = (
    tag: string,
    current: string[],
    setter: (next: string[]) => void
  ) => {
    setter(
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  };

  const handleModelChange = (nextModelId: string) => {
    const nextModel = getModelDefinition(nextModelId);
    const nextRatios = getGenerationAspectRatios(nextModel);
    const nextOutputOptions = getSelectableOutputCounts(nextModel);

    setModelId(nextModelId);
    setAspectRatio((current) =>
      nextRatios.includes(current) ? current : nextRatios[0] ?? '1:1'
    );
    setNumOutputs((current) =>
      Math.min(current, nextOutputOptions.at(-1) ?? 1)
    );
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      return;
    }

    if (intentTags.length === 0 && changeTags.length === 0 && !note.trim()) {
      setStatus(COPY.requireInput);
      return;
    }

    if (!projectId) {
      setStatus(COPY.selectProject);
      return;
    }

    setIsGenerating(true);
    setStatus(COPY.generating);

    try {
      const { imageUrls, resolvedPrompt } = await fetchJson<{
        imageUrls: string[];
        resolvedPrompt: string;
      }>('/api/generate-variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPrompt,
          intentTags,
          changeTags,
          note: note.trim(),
          numOutputs,
          projectId,
          replicateId: model.replicateId,
          aspectRatio,
        }),
      });

      const userIntent = buildVariationUserIntent({
        intentTags,
        changeTags,
        note,
      });

      stageBatch({
        sourceKind: 'variation-panel',
        projectId,
        parentNodeId: node.id,
        directionId: node.directionId,
        userIntent,
        resolvedPrompt,
        promptSource: 'variation-derived',
        modelId: model.id,
        modelLabel: model.name,
        aspectRatio,
        width: null,
        height: null,
        intentTags,
        changeTags,
        note: note.trim(),
        imageUrls,
      });

      setStatus(
        `${imageUrls.length}개의 변형을 staging에 올렸습니다. 아직 자식 노드는 생성되지 않았습니다.`
      );
    } catch (error) {
      console.error('Variation error:', error);
      setStatus(error instanceof Error ? error.message : COPY.generationError);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        className="self-start text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-accent)' }}
        onClick={onBack}
        disabled={isGenerating}
      >
        {COPY.back}
      </button>

      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {COPY.title}
      </h3>

      <div
        className="rounded px-2 py-1.5 text-[11px]"
        style={{
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-muted)',
        }}
      >
        {COPY.parentVersion} {getNodeSequenceLabel(node)}
        {!node.parentNodeId && COPY.parentRoot}
        {parentPrompt && (
          <span className="mt-0.5 block line-clamp-2">
            {COPY.prompt}: {parentPrompt}
          </span>
        )}
      </div>

      <StrategyContextCard
        title={direction ? `${direction.name} 방향 전략` : '방향 전략'}
        items={directionContextItems}
        emptyMessage={
          direction
            ? '이 방향에 아직 전략 메모가 없습니다. Settings에서 방향 가설과 적합 기준을 입력할 수 있습니다.'
            : '이 노드는 아직 direction에 연결되지 않았습니다. direction을 지정하면 방향 전략을 함께 볼 수 있습니다.'
        }
      />

      <StrategyContextCard
        title="프로젝트 컨텍스트"
        items={projectContextItems}
        isLoading={Boolean(projectId) && isProjectStrategyLoading}
        error={projectStrategyError}
        emptyMessage="아직 프로젝트 전략이 비어 있습니다. Settings에서 브리프와 제약 조건을 입력하면 변형 과정에서 함께 참고할 수 있습니다."
      />

      <TagSection
        label={COPY.intent}
        description={COPY.intentDescription}
        tags={INTENT_OPTIONS}
        selectedTags={intentTags}
        onToggle={(tag) => toggleTag(tag, intentTags, setIntentTags)}
        disabled={isGenerating}
        selectedColor="var(--accent-primary)"
      />

      <TagSection
        label={COPY.change}
        description={COPY.changeDescription}
        tags={CHANGE_OPTIONS}
        selectedTags={changeTags}
        onToggle={(tag) => toggleTag(tag, changeTags, setChangeTags)}
        disabled={isGenerating}
        selectedColor="var(--accent-secondary)"
      />

      <div className="flex flex-col gap-1">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {COPY.note}
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={COPY.notePlaceholder}
          rows={2}
          className="w-full resize-none rounded px-2.5 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
          disabled={isGenerating}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {COPY.model}
        </label>
        <select
          value={modelId}
          onChange={(event) => handleModelChange(event.target.value)}
          className="rounded px-2 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
          disabled={isGenerating}
        >
          {MODELS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} / {getModelDescription(item.id)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {COPY.ratio}
        </label>
        <div className="flex flex-wrap gap-1">
          {availableRatios.map((ratio) => {
            const selected = aspectRatio === ratio;

            return (
              <button
                key={ratio}
                className="rounded px-1.5 py-1 text-[10px] transition-all"
                style={{
                  backgroundColor: selected
                    ? 'var(--accent-primary)'
                    : 'var(--bg-active)',
                  color: selected
                    ? 'var(--text-inverse)'
                    : 'var(--text-secondary)',
                }}
                onClick={() => setAspectRatio(ratio)}
                disabled={isGenerating}
              >
                {ratio}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {COPY.outputCount}
        </label>
        <div className="flex flex-wrap gap-1">
          {outputOptions.map((count) => (
            <button
              key={count}
              className="rounded px-2.5 py-1 text-xs transition-all"
              style={{
                backgroundColor:
                  numOutputs === count
                    ? 'var(--accent-primary)'
                    : 'var(--bg-active)',
                color:
                  numOutputs === count
                    ? 'var(--text-inverse)'
                    : 'var(--text-secondary)',
              }}
              onClick={() => setNumOutputs(count)}
              disabled={isGenerating}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {status && (
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {status}
        </div>
      )}

      {latestVariationBatch && (
        <StagingBatchPreview
          batch={latestVariationBatch}
          title="이 노드의 최근 staging"
        />
      )}

      {isGenerating && (
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-active)' }}
        >
          <div
            className="h-full rounded-full animate-pulse"
            style={{ width: '100%', backgroundColor: 'var(--accent-primary)' }}
          />
        </div>
      )}

      <button
        className="w-full rounded py-2 text-xs font-semibold transition-opacity"
        style={{
          backgroundColor: isGenerating
            ? 'var(--bg-active)'
            : 'var(--accent-primary)',
          color: 'var(--text-inverse)',
          opacity: isGenerating ? 0.5 : 1,
        }}
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? COPY.generatingShort : `변형 ${numOutputs}개 생성`}
      </button>
    </div>
  );
}

function TagSection({
  label,
  description,
  tags,
  selectedTags,
  onToggle,
  disabled,
  selectedColor,
}: {
  label: string;
  description: string;
  tags: readonly string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  disabled: boolean;
  selectedColor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {description}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              className="rounded px-2 py-1 text-[11px] transition-all"
              style={{
                backgroundColor: selected
                  ? selectedColor
                  : 'var(--bg-active)',
                color: selected
                  ? 'var(--text-inverse)'
                  : 'var(--text-secondary)',
                border: selected
                  ? `1px solid ${selectedColor}`
                  : '1px solid transparent',
              }}
              onClick={() => onToggle(tag)}
              disabled={disabled}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getModelDescription(modelId: string) {
  return MODEL_DESCRIPTIONS[modelId] ?? '기본 모델';
}




