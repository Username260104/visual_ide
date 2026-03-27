'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { ManualEventComposer } from '@/components/activity/ManualEventComposer';
import { StrategyContextCard } from '@/components/context/StrategyContextCard';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { collectDescendantIds } from '@/lib/nodeTree';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import {
  getNodeDisplayPrompt,
  getPromptSourceLabel,
} from '@/lib/promptProvenance';
import type { Direction, NodeData, NodeStatus } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import {
  createSaveFeedbackKey,
  type SaveFeedbackEntry,
  useUIStore,
} from '@/stores/uiStore';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { ReparentNodeDialog } from '@/components/graph/ReparentNodeDialog';
import { StatusSelector, requiresStatusReason } from './StatusSelector';
import { VariationPanel } from './VariationPanel';

const COPY = {
  quickActions: '빠른 작업',
  variation: '변형 만들기',
  reparent: '상위 변경',
  archive: '보관',
  goToParent: '상위로 이동',
  direction: '브랜치',
  unclassified: '미분류',
  lineage: '계보',
  root: '루트',
  parent: '상위',
  depth: '깊이',
  step: '단계',
  intentTags: '의도 태그',
  changeTags: '변경 태그',
  notes: '메모',
  notePlaceholder: '메모를 입력해 주세요.',
  sourceInfo: '생성 정보',
  source: '출처',
  generated: 'AI 생성',
  uploaded: '업로드',
  model: '모델',
  size: '크기',
  ratio: '비율',
  prompt: '프롬프트',
  userIntent: '사용자 의도',
  resolvedPrompt: '정리된 프롬프트',
  promptSource: '프롬프트 출처',
  seed: '시드',
  created: '생성일',
  manualActivity: '로그',
  manualActivityEmpty: '이 이미지와 관련된 로그가 아직 없습니다.',
  directionStrategyTitle: '브랜치 전략',
  directionStrategyEmpty:
    '이 브랜치의 전략 정보가 아직 없습니다. 전략 탭에서 입력해 주세요.',
} as const;

export function DetailPanel() {
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const isOpen = useUIStore((state) => state.isDetailPanelOpen);
  const detailMode = useUIStore((state) => state.detailMode);
  const selectNode = useUIStore((state) => state.selectNode);
  const setDetailMode = useUIStore((state) => state.setDetailMode);
  const clearSaveFeedback = useUIStore((state) => state.clearSaveFeedback);
  const saveFeedbackByKey = useUIStore((state) => state.saveFeedbackByKey);
  const nodes = useNodeStore((state) => state.nodes);
  const patchNode = useNodeStore((state) => state.patchNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const directions = useDirectionStore((state) => state.directions);

  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const noteFeedbackKey = selectedNodeId
    ? createSaveFeedbackKey('node', selectedNodeId, 'note')
    : null;
  const noteFeedback = useUIStore((state) =>
    noteFeedbackKey ? state.saveFeedbackByKey[noteFeedbackKey] ?? null : null
  );
  const parentNode = node?.parentNodeId ? nodes[node.parentNodeId] : null;
  const nodeId = node?.id ?? null;
  const savedNote = node?.note ?? '';
  const directionList = useMemo(() => Object.values(directions), [directions]);
  const currentDirection = node?.directionId ? directions[node.directionId] : null;
  const directionStrategyItems = useMemo(
    () =>
      currentDirection
        ? [
            { label: '방향 가설', value: currentDirection.thesis },
            { label: '적합 기준', value: currentDirection.fitCriteria },
            { label: '피해야 할 느낌', value: currentDirection.antiGoal },
            { label: '참고 메모', value: currentDirection.referenceNotes },
          ]
        : [],
    [currentDirection]
  );
  const activityRefreshKey = useMemo(
    () =>
      Object.values(saveFeedbackByKey)
        .map((entry) => `${entry.key}:${entry.status}:${entry.updatedAt}`)
        .join('|'),
    [saveFeedbackByKey]
  );
  const rootNode = useMemo(
    () => (node ? getLineageRoot(node, nodes) : null),
    [node, nodes]
  );
  const lineageDepth = useMemo(
    () => (node ? getLineageDepth(node, nodes) : 0),
    [node, nodes]
  );
  const archiveImpact = useMemo(() => {
    if (!node) {
      return null;
    }

    const directChildrenCount = Object.values(nodes).filter(
      (candidate) => candidate.parentNodeId === node.id
    ).length;
    const descendantCount = collectDescendantIds(Object.values(nodes), node.id).size;

    return {
      directChildrenCount,
      descendantCount,
    };
  }, [node, nodes]);
  const [noteDraft, setNoteDraft] = useState('');
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reparentNodeId, setReparentNodeId] = useState<string | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const noteDraftRef = useRef(noteDraft);

  useEffect(() => {
    noteDraftRef.current = noteDraft;
  }, [noteDraft]);

  useEffect(() => {
    setNoteDraft(savedNote);
    setIsNoteDirty(false);
    setIsSavingNote(false);
  }, [nodeId, savedNote]);

  if (!isOpen || !node) {
    return null;
  }

  const noteMeta = getNoteMeta(noteFeedback, isNoteDirty);

  const handleBackToView = () => {
    setDetailMode('view');
  };

  const handleNavigateToParent = () => {
    if (node.parentNodeId) {
      selectNode(node.parentNodeId);
    }
  };

  const handleArchiveNode = async () => {
    if (isArchiving) {
      return;
    }

    setIsArchiving(true);

    try {
      const deleted = await deleteNode(node.id);
      if (deleted) {
        selectNode(null);
        setIsArchiveDialogOpen(false);
      }
    } finally {
      setIsArchiving(false);
    }
  };

  const handleStatusChange = (status: NodeStatus) => {
    void updateNode(
      node.id,
      {
        status,
        statusReason: requiresStatusReason(status) ? node.statusReason : null,
      },
      {
        rollbackOnError: true,
        feedback: {
          action: 'status',
          savingMessage: '상태 저장 중...',
          successMessage: '상태가 저장되었습니다.',
          errorMessage: '상태를 저장하지 못했습니다.',
        },
      }
    );
  };

  const handleStatusReasonChange = (statusReason: string | null) => {
    void updateNode(node.id, { statusReason });
  };

  const handleDirectionChange = (directionId: string | null) => {
    void updateNode(
      node.id,
      { directionId },
      {
        rollbackOnError: true,
        feedback: {
          action: 'direction',
          savingMessage: '브랜치 저장 중...',
          successMessage: '브랜치가 저장되었습니다.',
          errorMessage: '브랜치를 저장하지 못했습니다.',
        },
      }
    );
  };

  const persistNoteDraft = async () => {
    if (isSavingNote) {
      return;
    }

    const nextNote = noteDraftRef.current;

    if (nextNote === node.note) {
      setIsNoteDirty(false);

      if (noteFeedback?.status === 'error') {
        clearSaveFeedback(noteFeedback.key);
      }

      return;
    }

    setIsSavingNote(true);

    try {
      const savedNode = await patchNode(
        node.id,
        { note: nextNote },
        {
          feedback: {
            action: 'note',
            savingMessage: '메모 저장 중...',
            successMessage: '메모가 저장되었습니다.',
            errorMessage: '메모를 저장하지 못했습니다.',
          },
        }
      );

      setIsNoteDirty(noteDraftRef.current !== savedNode.note);
    } catch (error) {
      setIsNoteDirty(true);
      console.error('Failed to save note:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleNoteChange = (nextNote: string) => {
    setNoteDraft(nextNote);
    setIsNoteDirty(nextNote !== node.note);

    if (noteFeedback?.status === 'error') {
      clearSaveFeedback(noteFeedback.key);
    }
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void persistNoteDraft();
    }
  };

  if (detailMode === 'variation') {
    return (
      <PanelContainer animated>
        <NodePreview key={`${node.id}:${node.imageUrl}:compact`} node={node} compact />
        <VariationPanel node={node} onBack={handleBackToView} />
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <NodePreview key={`${node.id}:${node.imageUrl}:full`} node={node} />

      <div className="flex flex-col gap-4 p-4">
        <PanelSection label={COPY.quickActions}>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label={COPY.variation}
              tone="primary"
              onClick={() => setDetailMode('variation')}
            />
            <ActionButton
              label={COPY.reparent}
              onClick={() => setReparentNodeId(node.id)}
            />
            <ActionButton
              label={COPY.goToParent}
              onClick={handleNavigateToParent}
              disabled={!parentNode}
            />
            <ActionButton
              label={COPY.archive}
              tone="danger"
              onClick={() => setIsArchiveDialogOpen(true)}
            />
          </div>
        </PanelSection>

        <StatusSelector
          status={node.status}
          statusReason={node.statusReason}
          onStatusChange={handleStatusChange}
          onStatusReasonChange={handleStatusReasonChange}
        />

        <DirectionSection
          directionId={node.directionId}
          directions={directionList}
          currentDirection={currentDirection}
          onChange={handleDirectionChange}
        />

        {currentDirection && (
          <StrategyContextCard
            title={COPY.directionStrategyTitle}
            items={directionStrategyItems}
            emptyMessage={COPY.directionStrategyEmpty}
          />
        )}

        <LineageSection
          node={node}
          parentNode={parentNode}
          rootNode={rootNode}
          lineageDepth={lineageDepth}
          onNavigateToParent={handleNavigateToParent}
        />

        {node.intentTags.length > 0 && (
          <PanelSection label={COPY.intentTags}>
            <TagList tags={node.intentTags} tone="accent" />
          </PanelSection>
        )}

        {node.changeTags.length > 0 && (
          <PanelSection label={COPY.changeTags}>
            <TagList tags={node.changeTags} tone="neutral" />
          </PanelSection>
        )}

        <PanelSection label={COPY.notes}>
          <textarea
            value={noteDraft}
            onChange={(event) => handleNoteChange(event.target.value)}
            onBlur={() => void persistNoteDraft()}
            onKeyDown={handleNoteKeyDown}
            placeholder={COPY.notePlaceholder}
            rows={4}
            className="w-full resize-none rounded px-2.5 py-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          />
          {noteMeta && (
            <p className="mt-1 text-[10px]" style={{ color: noteMeta.color }}>
              {noteMeta.message}
            </p>
          )}
        </PanelSection>

        <ManualEventComposer node={node} nodes={nodes} />

        <ActivityTimeline
          projectId={node.projectId}
          nodeId={node.id}
          limit={10}
          title={COPY.manualActivity}
          emptyMessage={COPY.manualActivityEmpty}
          refreshKey={activityRefreshKey}
          compact
        />

        <SourceInfoSection node={node} />
      </div>

      <ReparentNodeDialog
        nodeId={reparentNodeId}
        onClose={() => setReparentNodeId(null)}
      />
      <DestructiveActionDialog
        isOpen={Boolean(isArchiveDialogOpen && archiveImpact)}
        title="이미지를 보관할까요?"
        description={`${getNodeSequenceLabel(node)} 이미지를 보관합니다.`}
        confirmLabel="이미지 보관"
        impacts={
          archiveImpact
            ? [
                `직계 자식 ${archiveImpact.directChildrenCount}개`,
                `전체 후손 ${archiveImpact.descendantCount}개`,
                node.directionId
                  ? '현재 브랜치 연결 정보가 함께 해제됩니다.'
                  : '미분류 이미지입니다.',
              ]
            : []
        }
        consequences={
          archiveImpact
            ? [
                archiveImpact.directChildrenCount > 0
                  ? '직계 자식 이미지는 루트 이미지로 승격됩니다.'
                  : '연결 구조 변화는 없습니다.',
                '이 이미지의 메모, 상태, 프롬프트 로그는 보관함으로 이동합니다.',
              ]
            : []
        }
        isSubmitting={isArchiving}
        onClose={() => {
          if (!isArchiving) {
            setIsArchiveDialogOpen(false);
          }
        }}
        onConfirm={() => void handleArchiveNode()}
      />
    </PanelContainer>
  );
}

function PanelContainer({
  children,
  animated = false,
}: {
  children: ReactNode;
  animated?: boolean;
}) {
  return (
    <div
      className={`flex w-[340px] shrink-0 flex-col overflow-y-auto border-l ${
        animated ? 'panel-slide-right' : ''
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      {children}
    </div>
  );
}

function NodePreview({
  node,
  compact = false,
}: {
  node: NodeData;
  compact?: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  return (
    <div
      className={`relative w-full shrink-0 overflow-hidden ${
        compact ? 'h-[120px]' : 'aspect-square'
      }`}
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {hasImageError && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
          }}
        >
          <div
            className="rounded px-3 py-2 text-center text-[11px]"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.36)',
              color: 'var(--text-secondary)',
            }}
          >
            이미지를 불러오지 못했습니다.
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.imageUrl}
        alt={getNodeSequenceLabel(node)}
        className="h-full w-full object-contain"
        draggable={false}
        onError={() => setHasImageError(true)}
        style={{ opacity: hasImageError ? 0 : 1 }}
      />

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span
          className="rounded px-2 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.62)',
            color: 'var(--text-inverse)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {getNodeSequenceLabel(node)}
        </span>
        <span
          className="rounded px-2 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: STATUS_COLORS[node.status],
            color:
              node.status === 'reviewing'
                ? 'var(--bg-base)'
                : 'var(--text-inverse)',
          }}
        >
          {STATUS_LABELS[node.status]}
        </span>
      </div>
    </div>
  );
}

function DirectionSection({
  directionId,
  directions,
  currentDirection,
  onChange,
}: {
  directionId: string | null;
  directions: Direction[];
  currentDirection: Direction | null;
  onChange: (directionId: string | null) => void;
}) {
  return (
    <PanelSection label={COPY.direction}>
      <select
        value={directionId ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded px-2.5 py-1.5 text-xs"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: `1px solid ${
            currentDirection?.color ?? 'var(--border-default)'
          }`,
        }}
      >
        <option value="">{COPY.unclassified}</option>
        {directions.map((direction) => (
          <option key={direction.id} value={direction.id}>
            {direction.name}
          </option>
        ))}
      </select>

      {currentDirection && (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentDirection.color }}
          />
          <span className="text-[10px]" style={{ color: currentDirection.color }}>
            {currentDirection.name}
          </span>
        </div>
      )}
    </PanelSection>
  );
}

function LineageSection({
  node,
  parentNode,
  rootNode,
  lineageDepth,
  onNavigateToParent,
}: {
  node: NodeData;
  parentNode: NodeData | null;
  rootNode: NodeData | null;
  lineageDepth: number;
  onNavigateToParent: () => void;
}) {
  return (
    <PanelSection label={COPY.lineage}>
      <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-1">
          <span>{getNodeSequenceLabel(node)}</span>
          {!node.parentNodeId && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--text-accent)',
              }}
            >
              {COPY.root}
            </span>
          )}
        </div>

        {rootNode && rootNode.id !== node.id && (
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {COPY.root} {getNodeSequenceLabel(rootNode)}
          </div>
        )}

        {parentNode && (
          <button
            className="flex items-center gap-1 text-left transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-accent)' }}
            onClick={onNavigateToParent}
          >
            <span>&larr;</span>
            <span>
              {COPY.parent} {getNodeSequenceLabel(parentNode)}
            </span>
          </button>
        )}

        {lineageDepth > 0 && (
          <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {COPY.depth}: {lineageDepth}
            {COPY.step}
          </div>
        )}
      </div>
    </PanelSection>
  );
}

function TagList({
  tags,
  tone,
}: {
  tags: string[];
  tone: 'accent' | 'neutral';
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded px-2 py-0.5 text-[11px]"
          style={
            tone === 'accent'
              ? {
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-accent)',
                }
              : {
                  backgroundColor: 'var(--bg-active)',
                  color: 'var(--text-primary)',
                }
          }
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function SourceInfoSection({ node }: { node: NodeData }) {
  const rows = buildSourceInfoRows(node);

  return (
    <PanelSection label={COPY.sourceInfo}>
      <div className="flex flex-col gap-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3">
            <span className="w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>
              {row.label}
            </span>
            <span
              className={`min-w-0 flex-1 ${
                row.wrap ? 'break-words whitespace-pre-wrap' : 'truncate'
              }`}
              style={{ color: 'var(--text-secondary)' }}
              title={row.wrap ? undefined : row.value}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

function buildSourceInfoRows(node: NodeData) {
  const rows: Array<{ label: string; value: string; wrap?: boolean }> = [
    {
      label: COPY.source,
      value: node.source === 'ai-generated' ? COPY.generated : COPY.uploaded,
    },
  ];

  if (node.modelUsed) {
    rows.push({ label: COPY.model, value: node.modelUsed });
  }

  if (node.width && node.height) {
    rows.push({ label: COPY.size, value: `${node.width} x ${node.height}` });
  }

  if (node.aspectRatio && node.aspectRatio !== 'custom') {
    rows.push({ label: COPY.ratio, value: node.aspectRatio });
  }

  if (node.userIntent) {
    rows.push({ label: COPY.userIntent, value: node.userIntent, wrap: true });
  }

  const displayPrompt = getNodeDisplayPrompt(node);
  if (displayPrompt) {
    rows.push({
      label:
        node.userIntent && node.userIntent !== displayPrompt
          ? COPY.resolvedPrompt
          : COPY.prompt,
      value: displayPrompt,
      wrap: true,
    });
  }

  const promptSourceLabel = getPromptSourceLabel(node.promptSource);
  if (promptSourceLabel) {
    rows.push({ label: COPY.promptSource, value: promptSourceLabel });
  }

  if (node.seed !== null) {
    rows.push({ label: COPY.seed, value: String(node.seed) });
  }

  rows.push({
    label: COPY.created,
    value: new Date(node.createdAt).toLocaleDateString('ko-KR'),
  });

  return rows;
}

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
}) {
  const styles =
    tone === 'primary'
      ? {
          backgroundColor: 'var(--accent-secondary)',
          color: 'var(--text-inverse)',
          border: '1px solid transparent',
        }
      : tone === 'danger'
        ? {
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--status-dropped)',
            border: '1px solid var(--border-default)',
          }
        : {
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          };

  return (
    <button
      className="rounded px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
      style={{
        ...styles,
        opacity: disabled ? 0.45 : 1,
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function getLineageDepth(node: NodeData, nodes: Record<string, NodeData>) {
  let depth = 0;
  let current: NodeData | undefined = node;
  const visited = new Set<string>();

  while (current?.parentNodeId) {
    if (visited.has(current.parentNodeId)) {
      break;
    }

    visited.add(current.parentNodeId);
    current = nodes[current.parentNodeId];
    depth += 1;
  }

  return depth;
}

function getLineageRoot(node: NodeData, nodes: Record<string, NodeData>) {
  let current: NodeData | undefined = node;
  const visited = new Set<string>();

  while (current?.parentNodeId) {
    if (visited.has(current.parentNodeId)) {
      break;
    }

    visited.add(current.parentNodeId);
    current = nodes[current.parentNodeId];
  }

  return current ?? node;
}

function getNoteMeta(
  feedback: SaveFeedbackEntry | null,
  isDirty: boolean
): { message: string; color: string } | null {
  if (feedback?.status === 'saving') {
    return {
      message: feedback.message,
      color: 'var(--text-accent)',
    };
  }

  if (feedback?.status === 'error') {
    return {
      message: feedback.message,
      color: 'var(--status-dropped)',
    };
  }

  if (isDirty) {
    return {
      message: '저장되지 않은 메모',
      color: 'var(--text-secondary)',
    };
  }

  if (feedback?.status === 'saved') {
    return {
      message: feedback.message,
      color: 'var(--status-final)',
    };
  }

  return null;
}


