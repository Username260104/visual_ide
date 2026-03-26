'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  StrategyContextCard,
  type StrategyContextItem,
} from '@/components/context/StrategyContextCard';
import { StagingBatchPreview } from '@/components/staging/StagingBatchPreview';
import { ModalShell } from '@/components/ui/ModalShell';
import { useProjectStrategy } from '@/hooks/useProjectStrategy';
import { fetchJson } from '@/lib/clientApi';
import { MODELS } from '@/lib/constants';
import {
  getDefaultAspectRatio,
  getDefaultResolution,
  getGenerationAspectRatios,
  getModelDefinition,
  getResolutionOptions,
  getSelectableOutputCounts,
} from '@/lib/imageGeneration';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { useUIStore } from '@/stores/uiStore';

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';
const DEFAULT_MODEL = getModelDefinition(DEFAULT_MODEL_ID);
const QUICK_SIZE_PRESETS = [
  [512, 512],
  [768, 768],
  [1024, 1024],
  [1024, 768],
  [768, 1024],
] as const;

const COPY = {
  title: '이미지 생성',
  projectContextTitle: '프로젝트 컨텍스트',
  projectContextSubtitle:
    '브리프와 제약을 보면서 프롬프트를 다듬을 수 있습니다.',
  projectContextEmpty:
    '아직 프로젝트 전략이 비어 있습니다. Settings에서 브리프를 입력하면 생성 시 함께 참고할 수 있습니다.',
  intent: '사용자 의도',
  improve: 'AI 개선',
  improving: '개선 중...',
  intentPlaceholder:
    '생성하고 싶은 이미지의 목적과 톤을 구체적으로 적어 주세요.',
  improvedPrompt: 'AI 개선본',
  improvedPromptHint:
    '현재 생성에는 개선본이 사용됩니다. 원문을 다시 수정하면 개선본은 초기화됩니다.',
  model: '모델',
  ratio: '비율',
  customSize: '직접 입력',
  sizeLabel: '크기',
  resolution: '해상도',
  guidance: '가이던스',
  steps: '스텝',
  outputCount: '생성 수량',
  batchFallback:
    '이 모델은 배치 생성을 지원하지 않아 선택한 수량만큼 병렬 요청으로 처리합니다.',
  cancel: '취소',
  generate: '생성',
  generating: '생성 중...',
  stagingTitle: '최근 생성 staging',
  improvePending:
    'AI가 입력한 의도를 더 구체적인 프롬프트로 정리하고 있습니다...',
  improveDone:
    'AI 개선본이 준비되었습니다. 생성 시 개선된 프롬프트를 사용합니다.',
  improveError:
    '프롬프트 개선에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  selectProject: '프로젝트를 먼저 선택해 주세요.',
  generatePending: '이미지를 생성하는 중입니다...',
  generateError:
    '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
} as const;

export function GenerateDialog() {
  const [userIntent, setUserIntent] = useState('');
  const [resolvedPrompt, setResolvedPrompt] = useState<string | null>(null);
  const [numOutputs, setNumOutputs] = useState(
    getSelectableOutputCounts(DEFAULT_MODEL).at(-1) ?? 1
  );
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [aspectRatio, setAspectRatio] = useState(
    getDefaultAspectRatio(DEFAULT_MODEL, { includeCustom: true })
  );
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [guidance, setGuidance] = useState(3);
  const [steps, setSteps] = useState(DEFAULT_MODEL.defaultSteps ?? 28);
  const [resolution, setResolution] = useState(
    getDefaultResolution(DEFAULT_MODEL) ?? ''
  );
  const [status, setStatus] = useState('');
  const [isImproving, setIsImproving] = useState(false);

  const projectId = useNodeStore((state) => state.projectId);
  const stagingBatches = useStagingStore((state) => state.batches);
  const stageBatch = useStagingStore((state) => state.stageBatch);
  const isGenerating = useUIStore((state) => state.isGenerating);
  const setGenerating = useUIStore((state) => state.setGenerating);
  const isOpen = useUIStore((state) => state.isGenerateDialogOpen);
  const setOpen = useUIStore((state) => state.setGenerateDialogOpen);
  const {
    project,
    isLoading: isProjectStrategyLoading,
    error: projectStrategyError,
  } = useProjectStrategy(isOpen ? projectId : null);

  const model = getModelDefinition(modelId);
  const busy = isGenerating || isImproving;
  const isCustomSize = aspectRatio === 'custom' && model.supportsCustomSize;
  const effectivePrompt = resolvedPrompt?.trim() || userIntent.trim();

  const availableRatios = useMemo(
    () => getGenerationAspectRatios(model, { includeCustom: true }),
    [model]
  );
  const outputOptions = useMemo(() => getSelectableOutputCounts(model), [model]);
  const resolutionOptions = useMemo(() => getResolutionOptions(model), [model]);
  const latestGenerateBatch = useMemo(
    () =>
      projectId
        ? stagingBatches.find(
            (batch) =>
              batch.projectId === projectId &&
              batch.sourceKind === 'generate-dialog'
          ) ?? null
        : null,
    [projectId, stagingBatches]
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

  if (!isOpen) {
    return null;
  }

  const resetTransientState = () => {
    setStatus('');
    setIsImproving(false);
  };

  const closeDialog = () => {
    if (!busy) {
      resetTransientState();
      setOpen(false);
    }
  };

  const handleModelChange = (nextModelId: string) => {
    const nextModel = getModelDefinition(nextModelId);
    const nextRatios = getGenerationAspectRatios(nextModel, {
      includeCustom: true,
    });
    const nextOutputOptions = getSelectableOutputCounts(nextModel);

    setModelId(nextModelId);
    setNumOutputs((current) =>
      Math.min(current, nextOutputOptions.at(-1) ?? 1)
    );
    setAspectRatio((current) =>
      nextRatios.includes(current)
        ? current
        : getDefaultAspectRatio(nextModel, { includeCustom: true })
    );
    if (nextModel.defaultSteps) {
      setSteps(nextModel.defaultSteps);
    }
    setResolution(getDefaultResolution(nextModel) ?? '');
  };

  const handleImprove = async () => {
    const trimmedIntent = userIntent.trim();
    if (!trimmedIntent || busy) {
      return;
    }

    setIsImproving(true);
    setStatus(COPY.improvePending);

    try {
      const { improvedPrompt } = await fetchJson<{ improvedPrompt: string }>(
        '/api/generate-prompts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmedIntent }),
        }
      );

      setResolvedPrompt(improvedPrompt);
      setStatus(COPY.improveDone);
    } catch (error) {
      console.error('Improve error:', error);
      setStatus(COPY.improveError);
    } finally {
      setIsImproving(false);
    }
  };

  const handleGenerate = async () => {
    if (!effectivePrompt || isGenerating) {
      return;
    }

    if (!projectId) {
      setStatus(COPY.selectProject);
      return;
    }

    setGenerating(true);
    setStatus(`${model.name} ${COPY.generatePending}`);

    try {
      const { imageUrls } = await fetchJson<{ imageUrls: string[] }>(
        '/api/generate-image',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: effectivePrompt,
            numOutputs,
            projectId,
            modelId: model.id,
            replicateId: model.replicateId,
            aspectRatio,
            customWidth: isCustomSize ? customWidth : undefined,
            customHeight: isCustomSize ? customHeight : undefined,
            guidance: model.supportsGuidance ? guidance : undefined,
            steps: model.maxSteps ? steps : undefined,
            resolution:
              resolutionOptions.length > 0 && !isCustomSize
                ? resolution
                : undefined,
          }),
        }
      );

      stageBatch({
        sourceKind: 'generate-dialog',
        projectId,
        userIntent: userIntent.trim(),
        resolvedPrompt: effectivePrompt,
        promptSource: resolvedPrompt ? 'ai-improved' : 'user-authored',
        modelId: model.id,
        modelLabel: model.name,
        aspectRatio,
        width: isCustomSize ? customWidth : null,
        height: isCustomSize ? customHeight : null,
        imageUrls,
      });

      setStatus(
        `${imageUrls.length}개의 결과를 staging에 올렸습니다. 아직 캔버스에는 추가되지 않았습니다.`
      );
    } catch (error) {
      console.error('Generation error:', error);
      setStatus(
        error instanceof Error
          ? `오류: ${error.message}`
          : COPY.generateError
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ModalShell
      onClose={closeDialog}
      closeDisabled={busy}
      panelClassName="w-[520px] max-h-[90vh] overflow-y-auto p-5"
    >
      <div className="flex flex-col gap-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {COPY.title}
        </h3>

        <StrategyContextCard
          title={COPY.projectContextTitle}
          items={projectContextItems}
          isLoading={Boolean(projectId) && isProjectStrategyLoading}
          error={projectStrategyError}
          emptyMessage={COPY.projectContextEmpty}
        />

        <DialogSection
          label={COPY.intent}
          right={
            <button
              className="rounded px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-accent)',
                opacity: !userIntent.trim() || busy ? 0.4 : 1,
              }}
              onClick={() => void handleImprove()}
              disabled={!userIntent.trim() || busy}
            >
              {isImproving ? COPY.improving : COPY.improve}
            </button>
          }
        >
          <textarea
            value={userIntent}
            onChange={(event) => {
              setUserIntent(event.target.value);
              if (resolvedPrompt !== null) {
                setResolvedPrompt(null);
              }
            }}
            placeholder={COPY.intentPlaceholder}
            className="min-h-[72px] w-full resize-none rounded px-2.5 py-2 text-xs focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
            autoFocus
            disabled={isGenerating}
          />
        </DialogSection>

        {resolvedPrompt && resolvedPrompt.trim() !== userIntent.trim() && (
          <DialogSection label={COPY.improvedPrompt}>
            <div
              className="rounded px-2.5 py-2 text-xs leading-5"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {resolvedPrompt}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {COPY.improvedPromptHint}
            </p>
          </DialogSection>
        )}

        <DialogSection label={COPY.model}>
          <div className="grid grid-cols-2 gap-1.5">
            {MODELS.map((item) => (
              <button
                key={item.id}
                className="rounded px-2 py-1.5 text-left text-[11px] transition-all"
                style={getChipStyles(item.id === modelId)}
                onClick={() => handleModelChange(item.id)}
                disabled={busy}
              >
                <div className="truncate font-semibold">{item.name}</div>
                <div className="mt-0.5 text-[9px]" style={{ opacity: 0.7 }}>
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </DialogSection>

        <DialogSection label={COPY.ratio}>
          <div className="flex flex-wrap gap-1">
            {availableRatios.map((ratio) => {
              const selected = aspectRatio === ratio;
              const preview = getAspectRatioPreview(ratio);

              return (
                <button
                  key={ratio}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-all"
                  style={getChipStyles(selected)}
                  onClick={() => setAspectRatio(ratio)}
                  disabled={busy}
                >
                  {ratio === 'custom' ? (
                    <span>{COPY.customSize}</span>
                  ) : (
                    <>
                      <div
                        style={{
                          width: preview.width,
                          height: preview.height,
                          borderRadius: 2,
                          border: `1.5px solid ${
                            selected
                              ? 'rgba(255,255,255,0.8)'
                              : 'rgba(255,255,255,0.3)'
                          }`,
                        }}
                      />
                      <span>{ratio}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </DialogSection>

        {isCustomSize && (
          <DialogSection
            label={`${COPY.sizeLabel} (${model.sizeMultiple}px 단위, 최대 ${model.maxWidth}px)`}
          >
            <div className="flex items-center gap-2">
              <DimensionInput
                value={customWidth}
                onChange={(value) =>
                  setCustomWidth(
                    snapDimension(value, model.sizeMultiple, model.maxWidth)
                  )
                }
                max={model.maxWidth}
                step={model.sizeMultiple}
                disabled={busy}
              />
              <span
                className="text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                x
              </span>
              <DimensionInput
                value={customHeight}
                onChange={(value) =>
                  setCustomHeight(
                    snapDimension(value, model.sizeMultiple, model.maxHeight)
                  )
                }
                max={model.maxHeight}
                step={model.sizeMultiple}
                disabled={busy}
              />
              <span
                className="text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                px
              </span>
            </div>

            <div className="mt-1.5 flex gap-1">
              {QUICK_SIZE_PRESETS.map(([width, height]) => {
                const selected =
                  customWidth === width && customHeight === height;

                return (
                  <button
                    key={`${width}x${height}`}
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: selected
                        ? 'var(--accent-primary)'
                        : 'var(--bg-active)',
                      color: selected
                        ? 'var(--text-inverse)'
                        : 'var(--text-muted)',
                    }}
                    onClick={() => {
                      setCustomWidth(width);
                      setCustomHeight(height);
                    }}
                    disabled={busy}
                  >
                    {width}x{height}
                  </button>
                );
              })}
            </div>
          </DialogSection>
        )}

        {resolutionOptions.length > 0 && !isCustomSize && (
          <DialogSection label={COPY.resolution}>
            <div className="flex gap-1">
              {resolutionOptions.map((item) => (
                <button
                  key={item}
                  className="rounded px-2 py-1 text-[11px] transition-all"
                  style={getChipStyles(resolution === item)}
                  onClick={() => setResolution(item)}
                  disabled={busy}
                >
                  {item}
                </button>
              ))}
            </div>
          </DialogSection>
        )}

        {model.supportsGuidance && (
          <DialogSection label={`${COPY.guidance} (${guidance})`}>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={guidance}
              onChange={(event) => setGuidance(Number(event.target.value))}
              className="w-full"
              disabled={busy}
            />
          </DialogSection>
        )}

        {model.maxSteps && (
          <DialogSection label={`${COPY.steps} (${steps})`}>
            <input
              type="range"
              min={1}
              max={model.maxSteps}
              step={1}
              value={steps}
              onChange={(event) => setSteps(Number(event.target.value))}
              className="w-full"
              disabled={busy}
            />
          </DialogSection>
        )}

        <DialogSection label={COPY.outputCount}>
          <div className="flex flex-wrap gap-1">
            {outputOptions.map((count) => (
              <button
                key={count}
                className="rounded px-2.5 py-1 text-xs transition-all"
                style={getChipStyles(numOutputs === count)}
                onClick={() => setNumOutputs(count)}
                disabled={busy}
              >
                {count}
              </button>
            ))}
          </div>
          {!model.supportsBatch && numOutputs > 1 && (
            <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {COPY.batchFallback}
            </div>
          )}
        </DialogSection>

        {status && (
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {status}
          </div>
        )}

        {latestGenerateBatch && (
          <StagingBatchPreview batch={latestGenerateBatch} title={COPY.stagingTitle} />
        )}

        {isGenerating && (
          <div
            className="h-1 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-active)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: '100%',
                backgroundColor: 'var(--accent-primary)',
                animation: 'progressPulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-xs"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
            onClick={closeDialog}
            disabled={busy}
          >
            {COPY.cancel}
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: busy
                ? 'var(--bg-active)'
                : 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              opacity: !effectivePrompt || busy ? 0.5 : 1,
            }}
            onClick={() => void handleGenerate()}
            disabled={!effectivePrompt || busy}
          >
            {isGenerating ? COPY.generating : `${numOutputs}개 ${COPY.generate}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DialogSection({
  label,
  right,
  children,
}: {
  label: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

function DimensionInput({
  value,
  onChange,
  max,
  step,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  step: number;
  disabled: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-24 rounded px-2 py-1 text-center text-xs"
      style={{
        backgroundColor: 'var(--bg-input)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-default)',
      }}
      min={step}
      max={max}
      step={step}
      disabled={disabled}
    />
  );
}

function getChipStyles(selected: boolean) {
  return {
    backgroundColor: selected ? 'var(--accent-primary)' : 'var(--bg-active)',
    color: selected ? 'var(--text-inverse)' : 'var(--text-secondary)',
    border: selected
      ? '1px solid var(--accent-primary)'
      : '1px solid transparent',
  };
}

function snapDimension(value: number, multiple: number, max: number) {
  const safeMultiple = Math.max(1, multiple);
  const normalizedValue = Number.isFinite(value) ? value : safeMultiple;

  return Math.min(
    max,
    Math.max(
      safeMultiple,
      Math.round(normalizedValue / safeMultiple) * safeMultiple
    )
  );
}

function getAspectRatioPreview(ratio: string) {
  const [width, height] = ratio.split(':').map(Number);

  if (!width || !height) {
    return { width: 14, height: 14 };
  }

  const maxSide = Math.max(width, height);

  return {
    width: Math.round((width / maxSide) * 16),
    height: Math.round((height / maxSide) * 16),
  };
}
