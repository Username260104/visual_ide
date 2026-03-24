'use client';

import { useMemo, useState } from 'react';
import { MODELS } from '@/lib/constants';
import { fetchJson } from '@/lib/clientApi';
import {
  getGenerationAspectRatios,
  getModelDefinition,
  getSelectableOutputCounts,
} from '@/lib/imageGeneration';
import { NODE_CHILD_OFFSET_Y, NODE_COLUMN_GAP } from '@/lib/nodeLayout';
import type { NodeData } from '@/lib/types';
import { useNodeStore } from '@/stores/nodeStore';

interface VariationPanelProps {
  node: NodeData;
  onBack: () => void;
}

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';

const COPY = {
  back: '\uC0C1\uC138 \uBCF4\uAE30\uB85C \uB3CC\uC544\uAC00\uAE30',
  title: '\uBCC0\uD615 \uB9CC\uB4E4\uAE30',
  parentVersion: '\uBD80\uBAA8 \uBC84\uC804',
  prompt: '\uD504\uB86C\uD504\uD2B8',
  intent: '\uC758\uB3C4',
  intentDescription:
    '\uC5B4\uB5A4 \uBC29\uD5A5\uC73C\uB85C \uBC14\uAFB8\uACE0 \uC2F6\uC740\uC9C0 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
  change: '\uBCC0\uACBD \uC694\uC18C',
  changeDescription:
    '\uBB34\uC5C7\uC744 \uC218\uC815\uD560\uC9C0 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
  note: '\uCD94\uAC00 \uBA54\uBAA8',
  notePlaceholder:
    '\uC6D0\uD558\uB294 \uBCC0\uD654\uAC00 \uC788\uB2E4\uBA74 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC801\uC5B4 \uC8FC\uC138\uC694.',
  model: '\uBAA8\uB378',
  ratio: '\uBE44\uC728',
  outputCount: '\uC0DD\uC131 \uC218\uB7C9',
  requireInput:
    '\uC758\uB3C4 \uD0DC\uADF8, \uBCC0\uACBD \uD0DC\uADF8, \uBA54\uBAA8 \uC911 \uD558\uB098 \uC774\uC0C1\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
  selectProject:
    '\uD504\uB85C\uC81D\uD2B8\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
  generating:
    '\uBCC0\uD615 \uC774\uBBF8\uC9C0\uB97C \uC0DD\uC131\uD558\uB294 \uC911\uC785\uB2C8\uB2E4...',
  generationError:
    '\uBCC0\uD615 \uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
  generatingShort: '\uC0DD\uC131 \uC911...',
  parentRoot: ' (\uB8E8\uD2B8)',
} as const;

const INTENT_OPTIONS = [
  '\uD1A4 \uC870\uC815',
  '\uAD6C\uB3C4 \uC815\uB9AC',
  '\uBD84\uC704\uAE30 \uBCC0\uACBD',
  '\uB514\uD14C\uC77C \uCD94\uAC00',
  '\uC2A4\uD0C0\uC77C \uBCC0\uACBD',
  '\uC694\uC18C \uC81C\uAC70',
  '\uC694\uC18C \uCD94\uAC00',
  '\uBE44\uC728 \uC870\uC815',
] as const;

const CHANGE_OPTIONS = [
  '\uBC30\uACBD',
  '\uC870\uBA85',
  '\uC0C9\uC0C1',
  '\uC778\uBB3C',
  '\uC624\uBE0C\uC81D\uD2B8',
  '\uD14D\uC2A4\uCC98',
  '\uD0C0\uC774\uD3EC',
  '\uB808\uC774\uC544\uC6C3',
] as const;

const MODEL_DESCRIPTIONS: Record<string, string> = {
  'flux-schnell': '\uBE60\uB978 \uC0DD\uC131, \uCD08\uC548 \uD0D0\uC0C9\uC6A9',
  'flux-dev': '\uADE0\uD615\uAC10 \uC788\uB294 \uACE0\uD488\uC9C8 \uBAA8\uB378',
  'flux-1.1-pro':
    '\uACE0\uD488\uC9C8 \uACB0\uACFC, \uCEE4\uC2A4\uD140 \uD574\uC0C1\uB3C4 \uC9C0\uC6D0',
  'flux-2-pro':
    '\uCD5C\uC2E0 \uC0C1\uC704 \uBAA8\uB378, \uCD5C\uB300 2048px',
  'seedream-4.5': 'ByteDance \uACC4\uC5F4, 4K \uB300\uC751',
  'ideogram-v3-turbo':
    '\uD14D\uC2A4\uD2B8\uC640 \uD0C0\uC774\uD3EC \uD45C\uD604\uC5D0 \uAC15\uC810',
  'recraft-v4':
    '\uBE0C\uB79C\uB529\uACFC \uADF8\uB798\uD53D \uC2A4\uD0C0\uC77C\uC5D0 \uAC15\uC810',
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

  const addNode = useNodeStore((state) => state.addNode);
  const projectId = useNodeStore((state) => state.projectId);
  const model = getModelDefinition(modelId);

  const availableRatios = useMemo(
    () => getGenerationAspectRatios(model),
    [model]
  );
  const outputOptions = useMemo(
    () => getSelectableOutputCounts(model),
    [model]
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
    if (isGenerating) return;

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
      const { imageUrls, prompt } = await fetchJson<{
        imageUrls: string[];
        prompt: string;
      }>('/api/generate-variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPrompt: node.prompt,
          intentTags,
          changeTags,
          note: note.trim(),
          numOutputs,
          projectId,
          replicateId: model.replicateId,
          aspectRatio,
        }),
      });

      const existingChildCount = useNodeStore
        .getState()
        .getChildren(node.id).length;

      await Promise.all(
        imageUrls.map((imageUrl, index) =>
          addNode({
            imageUrl,
            source: 'ai-generated',
            prompt,
            modelUsed: model.name,
            aspectRatio,
            parentNodeId: node.id,
            directionId: node.directionId,
            intentTags: [...intentTags],
            changeTags: [...changeTags],
            note: note.trim(),
            position: {
              x: node.position.x + (existingChildCount + index) * NODE_COLUMN_GAP,
              y: node.position.y + NODE_CHILD_OFFSET_Y,
            },
          })
        )
      );

      setStatus(
        `${imageUrls.length}\uAC1C\uC758 \uBCC0\uD615\uC744 \uC0DD\uC131\uD588\uC2B5\uB2C8\uB2E4.`
      );

      window.setTimeout(() => {
        onBack();
      }, 600);
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
        {COPY.parentVersion} v{node.versionNumber}
        {node.prompt && (
          <span className="mt-0.5 block truncate">
            {COPY.prompt}: {node.prompt}
          </span>
        )}
      </div>

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
        {isGenerating
          ? COPY.generatingShort
          : `\uBCC0\uD615 ${numOutputs}\uAC1C \uC0DD\uC131`}
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
  return MODEL_DESCRIPTIONS[modelId] ?? '\uAE30\uBCF8 \uBAA8\uB378';
}
