'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  StrategyContextCard,
  type StrategyContextItem,
} from '@/components/context/StrategyContextCard';
import {
  createMaskBlob,
  MaskEditor,
  type ImageDimensions,
  type MaskStroke,
} from '@/components/detail/MaskEditor';
import { StagingBatchPreview } from '@/components/staging/StagingBatchPreview';
import {
  ModalShell,
  WORKSPACE_MODAL_TARGET_ID,
} from '@/components/ui/ModalShell';
import { useProjectStrategy } from '@/hooks/useProjectStrategy';
import { MODELS } from '@/lib/constants';
import { fetchJson } from '@/lib/clientApi';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { getNodeDisplayPrompt } from '@/lib/promptProvenance';
import {
  getGenerationAspectRatios,
  getModelDefinition,
  getSelectableOutputCounts,
  VARIATION_INPAINT_MODEL,
} from '@/lib/imageGeneration';
import type { NodeData, VariationEditMode } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useGenerationSettingsStore } from '@/stores/generationSettingsStore';
import { useStagingStore } from '@/stores/stagingStore';

interface VariationPanelProps {
  node: NodeData;
  onBack: () => void;
}

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';
const DEFAULT_IMG2IMG_MODEL_ID =
  MODELS.find((model) => model.supportsImg2Img)?.id ?? DEFAULT_MODEL_ID;

const COPY = {
  back: '상세 보기로 돌아가기',
  title: '변형 만들기',
  parentVersion: '상위 버전',
  sourcePrompt: '기준 프롬프트',
  prompt: '수정 프롬프트',
  promptDescription:
    '원본 프롬프트가 먼저 들어가 있습니다. 그대로 고쳐 쓰면서 변형 방향을 직접 지정해 주세요.',
  promptPlaceholder:
    '이 이미지에서 유지할 것과 바꾸고 싶은 점을 포함해 프롬프트를 직접 수정해 주세요.',
  mode: '변형 방식',
  promptOnly: '프롬프트 변형',
  promptOnlyDescription: '프롬프트를 바탕으로 새 변형을 생성합니다.',
  imageToImage: '원본 기반 편집',
  imageToImageDescription: '부모 이미지를 조건으로 사용해 비슷한 구도에서 수정합니다.',
  inpaint: '인페인트',
  inpaintDescription: '칠한 영역만 다시 생성하고 나머지는 최대한 유지합니다.',
  mask: '인페인트 마스크',
  openMaskEditor: '크게 편집',
  clearMask: '마스크 지우기',
  editorTitle: '인페인트 마스크 편집',
  editorHint:
    '변경하고 싶은 부분만 칠해 주세요. 닫아도 현재 마스크는 유지됩니다.',
  closeEditor: '닫기',
  doneEditing: '편집 완료',
  brushSize: '브러시 크기',
  maskEmpty: '인페인트를 하려면 먼저 수정할 영역을 칠해 주세요.',
  model: '모델',
  inpaintEngine: '인페인트 엔진',
  ratio: '비율',
  ratioLocked: '원본 기반 편집과 인페인트는 원본 이미지 비율을 유지합니다.',
  outputCount: '생성 수량',
  requirePrompt: '수정 프롬프트를 입력해 주세요.',
  selectProject: '프로젝트를 먼저 선택해 주세요.',
  generating: '변형 이미지를 생성하는 중입니다...',
  maskUploading: '인페인트 마스크를 업로드하는 중입니다...',
  generationError: '변형 생성 중 오류가 발생했습니다. 다시 시도해 주세요.',
  generatingShort: '생성 중...',
  parentRoot: ' (루트)',
} as const;

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
  const sourcePrompt = getNodeDisplayPrompt(node) ?? '';
  const [variationMode, setVariationMode] =
    useState<VariationEditMode>('prompt-only');
  const [promptDraft, setPromptDraft] = useState(sourcePrompt);
  const [numOutputs, setNumOutputs] = useState(2);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [maskBrushSize, setMaskBrushSize] = useState(28);
  const [maskStrokes, setMaskStrokes] = useState<MaskStroke[]>([]);
  const [maskImageDimensions, setMaskImageDimensions] =
    useState<ImageDimensions | null>(null);
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);
  const [workspaceModalTarget, setWorkspaceModalTarget] =
    useState<Element | null>(null);
  const [status, setStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const defaultModelId = useGenerationSettingsStore(
    (state) => state.defaultModelId
  );
  const defaultAspectRatio = useGenerationSettingsStore(
    (state) => state.defaultAspectRatio
  );
  const defaultOutputCount = useGenerationSettingsStore(
    (state) => state.defaultOutputCount
  );

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
  const isImageToImageMode = variationMode === 'image-to-image';
  const isInpaintMode = variationMode === 'inpaint';
  const usesSourceImage = isImageToImageMode || isInpaintMode;
  const hasMask = maskStrokes.length > 0;
  const effectiveModelLabel = isInpaintMode
    ? VARIATION_INPAINT_MODEL.name
    : model.name;
  const effectiveModelId = isInpaintMode
    ? VARIATION_INPAINT_MODEL.id
    : model.id;

  const availableRatios = useMemo(
    () => getGenerationAspectRatios(model),
    [model]
  );
  const outputOptions = useMemo(
    () => (isInpaintMode ? [1, 2, 3, 4] : getSelectableOutputCounts(model)),
    [isInpaintMode, model]
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

  useEffect(() => {
    const nextModel = getModelDefinition(defaultModelId);
    const nextRatios = getGenerationAspectRatios(nextModel);
    const nextOutputOptions = getSelectableOutputCounts(nextModel);

    setVariationMode('prompt-only');
    setPromptDraft(sourcePrompt);
    setModelId(nextModel.id);
    setAspectRatio(
      nextRatios.includes(defaultAspectRatio)
        ? defaultAspectRatio
        : nextRatios[0] ?? '1:1'
    );
    setNumOutputs(
      nextOutputOptions.includes(defaultOutputCount)
        ? defaultOutputCount
        : nextOutputOptions.at(-1) ?? 1
    );
    setMaskBrushSize(28);
    setMaskStrokes([]);
    setMaskImageDimensions(null);
    setIsMaskEditorOpen(false);
    setStatus('');
  }, [
    defaultAspectRatio,
    defaultModelId,
    defaultOutputCount,
    node.id,
    sourcePrompt,
  ]);

  useEffect(() => {
    if (variationMode === 'image-to-image' && !model.supportsImg2Img) {
      setVariationMode('prompt-only');
    }
  }, [model.supportsImg2Img, variationMode]);

  useEffect(() => {
    if (!outputOptions.includes(numOutputs)) {
      setNumOutputs(outputOptions.at(-1) ?? 1);
    }
  }, [numOutputs, outputOptions]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    setWorkspaceModalTarget(document.getElementById(WORKSPACE_MODAL_TARGET_ID));
  }, []);

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

  const handleVariationModeChange = (nextMode: VariationEditMode) => {
    if (nextMode === 'image-to-image' && !model.supportsImg2Img) {
      handleModelChange(DEFAULT_IMG2IMG_MODEL_ID);
    }

    if (nextMode !== 'inpaint') {
      setMaskStrokes([]);
      setMaskImageDimensions(null);
      setIsMaskEditorOpen(false);
    }

    setVariationMode(nextMode);
    setStatus('');
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      return;
    }

    const trimmedPrompt = promptDraft.trim();
    if (!trimmedPrompt) {
      setStatus(COPY.requirePrompt);
      return;
    }

    if (!projectId) {
      setStatus(COPY.selectProject);
      return;
    }

    if (isInpaintMode && (!hasMask || !maskImageDimensions)) {
      setStatus(COPY.maskEmpty);
      return;
    }

    setIsGenerating(true);
    setStatus(isInpaintMode ? COPY.maskUploading : COPY.generating);

    let uploadedMask:
      | {
          imageUrl: string;
          imagePath: string;
        }
      | null = null;

    try {
      if (isInpaintMode) {
        const maskBlob = await createMaskBlob(maskStrokes, maskImageDimensions);
        if (!maskBlob) {
          throw new Error(COPY.maskEmpty);
        }

        uploadedMask = await uploadMaskImage(projectId, maskBlob);
        setStatus(COPY.generating);
      }

      const {
        imageUrls,
        resolvedPrompt,
        width,
        height,
        aspectRatio: generatedAspectRatio,
      } = await fetchJson<{
        imageUrls: string[];
        resolvedPrompt: string;
        width: number | null;
        height: number | null;
        aspectRatio: string | null;
      }>('/api/generate-variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          numOutputs,
          projectId,
          modelId: model.id,
          replicateId: model.replicateId,
          aspectRatio,
          editMode: variationMode,
          sourceImageUrl: usesSourceImage ? node.imageUrl : undefined,
          maskImageUrl: uploadedMask?.imageUrl,
          maskImagePath: uploadedMask?.imagePath,
        }),
      });

      stageBatch({
        sourceKind: 'variation-panel',
        projectId,
        parentNodeId: node.id,
        directionId: node.directionId,
        userIntent: trimmedPrompt,
        resolvedPrompt,
        promptSource: 'variation-derived',
        modelId: effectiveModelId,
        modelLabel: effectiveModelLabel,
        aspectRatio: generatedAspectRatio,
        width,
        height,
        variationMode,
        sourceImageUrl: usesSourceImage ? node.imageUrl : null,
        maskImageUrl: null,
        intentTags: [],
        changeTags: [],
        note: null,
        imageUrls,
      });

      setStatus(
        `${imageUrls.length}개의 변형 결과를 검토함에 올렸습니다. 아직 자식 노드는 생성되지 않았습니다.`
      );
    } catch (error) {
      console.error('Variation error:', error);
      setStatus(error instanceof Error ? error.message : COPY.generationError);
    } finally {
      if (uploadedMask?.imagePath) {
        void cleanupUploadedImage(uploadedMask.imagePath);
      }
      setIsGenerating(false);
    }
  };

  return (
    <>
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
          {sourcePrompt && (
            <span className="mt-0.5 block line-clamp-2">
              {COPY.sourcePrompt}: {sourcePrompt}
            </span>
          )}
        </div>

        <StrategyContextCard
          title={direction ? `${direction.name} 브랜치 전략` : '브랜치 전략'}
          items={directionContextItems}
          emptyMessage={
            direction
              ? '이 브랜치에 아직 전략 메모가 없습니다. 전략 탭에서 방향 가설과 적합 기준을 입력할 수 있습니다.'
              : '이 노드는 아직 브랜치에 연결되지 않았습니다. 브랜치를 지정하면 브랜치 전략을 함께 볼 수 있습니다.'
          }
        />

        <StrategyContextCard
          title="프로젝트 컨텍스트"
          items={projectContextItems}
          isLoading={Boolean(projectId) && isProjectStrategyLoading}
          error={projectStrategyError}
          emptyMessage="아직 프로젝트 전략이 비어 있습니다. 전략 탭에서 브리프와 제약 조건을 입력하면 변형 과정에서 함께 참고할 수 있습니다."
        />

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {COPY.prompt}
          </label>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {COPY.promptDescription}
          </div>
          <textarea
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            placeholder={COPY.promptPlaceholder}
            rows={5}
            className="w-full resize-none rounded px-2.5 py-2 text-xs"
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
            {COPY.mode}
          </label>
          <div className="grid gap-1.5">
            <VariationModeButton
              label={COPY.promptOnly}
              description={COPY.promptOnlyDescription}
              selected={variationMode === 'prompt-only'}
              onClick={() => handleVariationModeChange('prompt-only')}
              disabled={isGenerating}
            />
            <VariationModeButton
              label={COPY.imageToImage}
              description={COPY.imageToImageDescription}
              selected={variationMode === 'image-to-image'}
              onClick={() => handleVariationModeChange('image-to-image')}
              disabled={isGenerating}
              meta={
                model.supportsImg2Img
                  ? '현재 모델 지원'
                  : `${getModelDefinition(DEFAULT_IMG2IMG_MODEL_ID).name}로 자동 전환`
              }
            />
            <VariationModeButton
              label={COPY.inpaint}
              description={COPY.inpaintDescription}
              selected={variationMode === 'inpaint'}
              onClick={() => handleVariationModeChange('inpaint')}
              disabled={isGenerating}
              meta={VARIATION_INPAINT_MODEL.name}
            />
          </div>
        </div>

        {isImageToImageMode && (
          <div className="flex flex-col gap-2 rounded-lg border p-3" style={cardStyle()}>
            <div
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              원본 이미지
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={node.imageUrl}
              alt="variation source"
              className="max-h-[220px] w-full rounded-md object-contain"
            />
          </div>
        )}

        {isInpaintMode && (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={cardStyle()}>
            <div className="flex items-start justify-between gap-3">
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {COPY.mask}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-inverse)',
                    opacity: isGenerating ? 0.5 : 1,
                  }}
                  onClick={() => setIsMaskEditorOpen(true)}
                  disabled={isGenerating}
                >
                  {COPY.openMaskEditor}
                </button>
                <button
                  className="rounded px-2 py-1 text-[11px]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    opacity: hasMask && !isGenerating ? 1 : 0.45,
                  }}
                  onClick={() => {
                    setMaskStrokes([]);
                    setStatus('');
                  }}
                  disabled={isGenerating || !hasMask}
                >
                  {COPY.clearMask}
                </button>
              </div>
            </div>

            <MaskEditor
              imageUrl={node.imageUrl}
              brushSize={maskBrushSize}
              strokes={maskStrokes}
              onImageReady={setMaskImageDimensions}
              disabled
              maxHeight={260}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {isInpaintMode ? COPY.inpaintEngine : COPY.model}
          </label>
          {isInpaintMode ? (
            <div
              className="rounded px-2 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {VARIATION_INPAINT_MODEL.name}
            </div>
          ) : (
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
              {MODELS.map((item) => {
                const disabled = isImageToImageMode && !item.supportsImg2Img;

                return (
                  <option key={item.id} value={item.id} disabled={disabled}>
                    {item.name} / {getModelDescription(item.id)}
                    {disabled ? ' (원본 기반 편집 미지원)' : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {!usesSourceImage ? (
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
        ) : (
          <div className="rounded px-2.5 py-2 text-[11px]" style={cardStyle()}>
            {COPY.ratioLocked}
          </div>
        )}

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
            title="이 노드의 최근 검토 결과"
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

      <MaskEditorDialog
        isOpen={isMaskEditorOpen}
        imageUrl={node.imageUrl}
        strokes={maskStrokes}
        onChangeStrokes={setMaskStrokes}
        brushSize={maskBrushSize}
        onChangeBrushSize={setMaskBrushSize}
        onImageReady={setMaskImageDimensions}
        hasMask={hasMask}
        isGenerating={isGenerating}
        onClear={() => setMaskStrokes([])}
        onClose={() => setIsMaskEditorOpen(false)}
        portalTarget={workspaceModalTarget}
      />
    </>
  );
}

function VariationModeButton({
  label,
  description,
  selected,
  onClick,
  disabled,
  meta,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  meta?: string;
}) {
  return (
    <button
      className="rounded-lg border px-3 py-2 text-left transition-all"
      style={{
        backgroundColor: selected ? 'var(--accent-subtle)' : 'var(--bg-active)',
        borderColor: selected
          ? 'var(--accent-primary)'
          : 'var(--border-default)',
        opacity: disabled ? 0.55 : 1,
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-xs font-semibold"
          style={{
            color: selected ? 'var(--text-accent)' : 'var(--text-primary)',
          }}
        >
          {label}
        </span>
        {meta && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {meta}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    </button>
  );
}

function MaskEditorDialog({
  isOpen,
  imageUrl,
  strokes,
  onChangeStrokes,
  brushSize,
  onChangeBrushSize,
  onImageReady,
  hasMask,
  isGenerating,
  onClear,
  onClose,
  portalTarget,
}: {
  isOpen: boolean;
  imageUrl: string;
  strokes: MaskStroke[];
  onChangeStrokes: (next: MaskStroke[]) => void;
  brushSize: number;
  onChangeBrushSize: (value: number) => void;
  onImageReady: (dimensions: ImageDimensions) => void;
  hasMask: boolean;
  isGenerating: boolean;
  onClear: () => void;
  onClose: () => void;
  portalTarget: Element | null;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell
      onClose={onClose}
      closeDisabled={isGenerating}
      portalTarget={portalTarget}
      position={portalTarget ? 'absolute' : 'fixed'}
      backdropStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.58)',
        padding: '24px',
      }}
      panelClassName="flex flex-col gap-4 overflow-hidden p-5"
      panelStyle={{
        width: 'min(1120px, calc(100% - 48px))',
        height: 'min(820px, calc(100% - 48px))',
        maxHeight: 'calc(100% - 48px)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {COPY.editorTitle}
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {COPY.editorHint}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded px-2.5 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              opacity: hasMask ? 1 : 0.45,
            }}
            onClick={onClear}
            disabled={!hasMask || isGenerating}
          >
            {COPY.clearMask}
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              opacity: isGenerating ? 0.5 : 1,
            }}
            onClick={onClose}
            disabled={isGenerating}
          >
            {COPY.doneEditing}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MaskEditor
          imageUrl={imageUrl}
          brushSize={brushSize}
          strokes={strokes}
          onChangeStrokes={onChangeStrokes}
          onImageReady={onImageReady}
          disabled={isGenerating}
          maxHeight="72vh"
        />
      </div>

      <div className="flex items-center gap-3">
        <label
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {COPY.brushSize}
        </label>
        <input
          type="range"
          min={12}
          max={96}
          step={2}
          value={brushSize}
          onChange={(event) => onChangeBrushSize(Number(event.target.value))}
          className="w-full"
          disabled={isGenerating}
        />
        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {brushSize}px
        </span>
      </div>

      <div className="flex justify-end">
        <button
          className="rounded px-3 py-1.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onClick={onClose}
          disabled={isGenerating}
        >
          {COPY.closeEditor}
        </button>
      </div>
    </ModalShell>
  );
}

function cardStyle() {
  return {
    backgroundColor: 'var(--bg-active)',
    borderColor: 'var(--border-default)',
  };
}

function getModelDescription(modelId: string) {
  return MODEL_DESCRIPTIONS[modelId] ?? '기본 모델';
}

async function uploadMaskImage(projectId: string, maskBlob: Blob) {
  const formData = new FormData();
  formData.append(
    'image',
    new File([maskBlob], `variation-mask-${Date.now()}.png`, {
      type: 'image/png',
    })
  );
  formData.append('projectId', projectId);

  return fetchJson<{ imageUrl: string; imagePath: string }>('/api/upload-image', {
    method: 'POST',
    body: formData,
  });
}

async function cleanupUploadedImage(imagePath: string) {
  try {
    await fetch('/api/upload-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    });
  } catch (error) {
    console.warn('Failed to cleanup uploaded mask image:', error);
  }
}
