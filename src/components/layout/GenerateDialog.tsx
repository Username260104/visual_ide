'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { MODELS } from '@/lib/constants';
import { fetchJson } from '@/lib/clientApi';
import {
  getDefaultAspectRatio,
  getDefaultResolution,
  getGenerationAspectRatios,
  getModelDefinition,
  getResolutionOptions,
  getSelectableOutputCounts,
} from '@/lib/imageGeneration';
import { NODE_COLUMN_GAP, NODE_ROW_GAP } from '@/lib/nodeLayout';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';
import { ModalShell } from '@/components/ui/ModalShell';

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';
const DEFAULT_MODEL = getModelDefinition(DEFAULT_MODEL_ID);
const QUICK_SIZE_PRESETS = [
  [512, 512],
  [768, 768],
  [1024, 1024],
  [1024, 768],
  [768, 1024],
] as const;

export function GenerateDialog() {
  const [prompt, setPrompt] = useState('');
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

  const addNode = useNodeStore((state) => state.addNode);
  const projectId = useNodeStore((state) => state.projectId);
  const isGenerating = useUIStore((state) => state.isGenerating);
  const setGenerating = useUIStore((state) => state.setGenerating);
  const isOpen = useUIStore((state) => state.isGenerateDialogOpen);
  const setOpen = useUIStore((state) => state.setGenerateDialogOpen);

  const model = getModelDefinition(modelId);
  const busy = isGenerating || isImproving;
  const isCustomSize = aspectRatio === 'custom' && model.supportsCustomSize;

  const availableRatios = useMemo(
    () => getGenerationAspectRatios(model, { includeCustom: true }),
    [model]
  );
  const outputOptions = useMemo(
    () => getSelectableOutputCounts(model),
    [model]
  );
  const resolutionOptions = useMemo(
    () => getResolutionOptions(model),
    [model]
  );

  if (!isOpen) return null;

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
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || busy) return;

    setIsImproving(true);
    setStatus('프롬프트를 다듬는 중입니다...');

    try {
      const { improvedPrompt } = await fetchJson<{ improvedPrompt: string }>(
        '/api/generate-prompts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmedPrompt }),
        }
      );

      setPrompt(improvedPrompt);
      setStatus('프롬프트를 더 구체적으로 정리했습니다.');
    } catch (error) {
      console.error('Improve error:', error);
      setStatus('프롬프트 개선에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsImproving(false);
    }
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGenerating) return;

    if (!projectId) {
      setStatus('프로젝트를 먼저 선택해 주세요.');
      return;
    }

    setGenerating(true);
    setStatus(`${model.name}로 이미지를 생성하는 중입니다...`);

    try {
      const { imageUrls } = await fetchJson<{ imageUrls: string[] }>(
        '/api/generate-image',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmedPrompt,
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

      await Promise.all(
        imageUrls.map((imageUrl, index) =>
          addNode({
            imageUrl,
            source: 'ai-generated',
            prompt: trimmedPrompt,
            modelUsed: model.name,
            aspectRatio,
            width: isCustomSize ? customWidth : null,
            height: isCustomSize ? customHeight : null,
            position: {
              x: (index % 4) * NODE_COLUMN_GAP,
              y: Math.floor(index / 4) * NODE_ROW_GAP,
            },
          })
        )
      );

      setStatus(`${imageUrls.length}장의 이미지를 생성했습니다.`);

      window.setTimeout(() => {
        resetTransientState();
        setOpen(false);
        setPrompt('');
      }, 500);
    } catch (error) {
      console.error('Generation error:', error);
      setStatus(
        error instanceof Error
          ? `오류: ${error.message}`
          : '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'
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
          이미지 생성
        </h3>

        <DialogSection
          label="프롬프트"
          right={
            <button
              className="rounded px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-active)',
                color: 'var(--text-accent)',
                opacity: !prompt.trim() || busy ? 0.4 : 1,
              }}
              onClick={() => void handleImprove()}
              disabled={!prompt.trim() || busy}
            >
              {isImproving ? '개선 중...' : 'AI 개선'}
            </button>
          }
        >
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="생성할 이미지를 구체적으로 설명해 주세요."
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

        <DialogSection label="모델">
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

        <DialogSection label="비율">
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
                    <span>직접 입력</span>
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
            label={`해상도 (${model.sizeMultiple}px 단위, 최대 ${model.maxWidth}px)`}
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
          <DialogSection label="해상도">
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
          <DialogSection label={`가이던스 (${guidance})`}>
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
          <DialogSection label={`스텝 수 (${steps})`}>
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

        <DialogSection label="생성 수량">
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
              이 모델은 배치 생성을 지원하지 않아 {numOutputs}번 병렬 호출로
              처리합니다.
            </div>
          )}
        </DialogSection>

        {status && (
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {status}
          </div>
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
            취소
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: busy
                ? 'var(--bg-active)'
                : 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              opacity: !prompt.trim() || busy ? 0.5 : 1,
            }}
            onClick={() => void handleGenerate()}
            disabled={!prompt.trim() || busy}
          >
            {isGenerating ? '생성 중...' : `${numOutputs}장 생성`}
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
