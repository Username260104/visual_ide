'use client';

import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DestructiveActionDialog } from '@/components/ui/DestructiveActionDialog';
import { useImageDrop } from '@/hooks/useImageDrop';
import { collectDescendantIds } from '@/lib/nodeTree';
import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import type { NodeData } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';
import { DropOverlay } from './DropOverlay';
import { FullscreenImageViewer } from './FullscreenImageViewer';
import { ImageNode } from './ImageNode';
import { NodeContextMenu, type NodeContextMenuAction } from './NodeContextMenu';
import { ParentSelectDialog } from './ParentSelectDialog';
import { ReparentNodeDialog } from './ReparentNodeDialog';

const nodeTypes: NodeTypes = {
  imageNode: ImageNode,
};

const INITIAL_FIT_VIEW_OPTIONS = {
  padding: 0.2,
  duration: 0,
  maxZoom: 1.2,
};

function NodeGraphInner() {
  const { fitView, getViewport } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const setZoomLevel = useUIStore((state) => state.setZoomLevel);
  const selectNode = useUIStore((state) => state.selectNode);
  const setDetailMode = useUIStore((state) => state.setDetailMode);
  const setGenerateDialogOpen = useUIStore(
    (state) => state.setGenerateDialogOpen
  );
  const branchFilter = useUIStore((state) => state.branchFilter);
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const nodesById = useNodeStore((state) => state.nodes);
  const projectId = useNodeStore((state) => state.projectId);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const directions = useDirectionStore((state) => state.directions);
  const { isDragging, onDragOver, onDragLeave, onDrop } = useImageDrop();
  const initialFitProjectIdRef = useRef<string | null>(null);
  const initialFitFrameRef = useRef<number | null>(null);

  const nodeList = useMemo(() => Object.values(nodesById), [nodesById]);
  const filteredNodeList = useMemo(() => {
    switch (branchFilter.kind) {
      case 'unclassified':
        return nodeList.filter((node) => node.directionId === null);
      case 'direction':
        return nodeList.filter(
          (node) => node.directionId === branchFilter.directionId
        );
      case 'all':
      default:
        return nodeList;
    }
  }, [branchFilter, nodeList]);
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodeList.map((node) => node.id)),
    [filteredNodeList]
  );
  const nodeCount = filteredNodeList.length;
  const [rfNodes, setRfNodes] = useState<Node<NodeData>[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null);
  const [reparentNodeId, setReparentNodeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const contextMenuNode = contextMenu ? nodesById[contextMenu.nodeId] : null;
  const fullscreenNode = fullscreenNodeId ? nodesById[fullscreenNodeId] ?? null : null;
  const deleteTargetNode = deleteTargetId ? nodesById[deleteTargetId] : null;
  const deleteTargetLabel = deleteTargetNode
    ? getNodeSequenceLabel(deleteTargetNode)
    : '';

  useEffect(() => {
    setRfNodes((current) =>
      syncFlowNodes(current, filteredNodeList, selectedNodeId)
    );
  }, [filteredNodeList, selectedNodeId]);

  useEffect(() => {
    initialFitProjectIdRef.current = null;

    if (initialFitFrameRef.current !== null) {
      cancelAnimationFrame(initialFitFrameRef.current);
      initialFitFrameRef.current = null;
    }
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (initialFitFrameRef.current !== null) {
        cancelAnimationFrame(initialFitFrameRef.current);
        initialFitFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!projectId || nodeList.length > 0) {
      return;
    }

    if (initialFitProjectIdRef.current === projectId) {
      return;
    }

    initialFitProjectIdRef.current = projectId;
    setZoomLevel(1);
  }, [nodeList.length, projectId, setZoomLevel]);

  useEffect(() => {
    if (
      !projectId ||
      branchFilter.kind !== 'all' ||
      nodeList.length === 0 ||
      rfNodes.length === 0 ||
      !nodesInitialized
    ) {
      return;
    }

    if (initialFitProjectIdRef.current === projectId) {
      return;
    }

    initialFitProjectIdRef.current = projectId;
    let cancelled = false;

    initialFitFrameRef.current = requestAnimationFrame(() => {
      initialFitFrameRef.current = null;

      if (cancelled) {
        return;
      }

      void Promise.resolve(fitView(INITIAL_FIT_VIEW_OPTIONS)).then(() => {
        if (cancelled) {
          return;
        }

        setZoomLevel(getViewport().zoom);
      });
    });

    return () => {
      cancelled = true;

      if (initialFitFrameRef.current !== null) {
        cancelAnimationFrame(initialFitFrameRef.current);
        initialFitFrameRef.current = null;
      }
    };
  }, [
    branchFilter.kind,
    fitView,
    getViewport,
    nodeList.length,
    nodesInitialized,
    projectId,
    rfNodes.length,
    setZoomLevel,
  ]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  useEffect(() => {
    if (selectedNodeId && !filteredNodeIds.has(selectedNodeId)) {
      selectNode(null);
    }

    if (contextMenu && !nodesById[contextMenu.nodeId]) {
      setContextMenu(null);
    }

    if (contextMenu && !filteredNodeIds.has(contextMenu.nodeId)) {
      setContextMenu(null);
    }

    if (reparentNodeId && !nodesById[reparentNodeId]) {
      setReparentNodeId(null);
    }

    if (reparentNodeId && !filteredNodeIds.has(reparentNodeId)) {
      setReparentNodeId(null);
    }

    if (deleteTargetId && !nodesById[deleteTargetId]) {
      setDeleteTargetId(null);
      setIsDeletingNode(false);
    }

    if (fullscreenNodeId && !nodesById[fullscreenNodeId]) {
      setFullscreenNodeId(null);
    }
  }, [
    contextMenu,
    deleteTargetId,
    filteredNodeIds,
    fullscreenNodeId,
    nodesById,
    reparentNodeId,
    selectNode,
    selectedNodeId,
  ]);

  const rfEdges: Edge[] = useMemo(
    () =>
      filteredNodeList
        .filter(
          (node) =>
            node.parentNodeId !== null && filteredNodeIds.has(node.parentNodeId)
        )
        .map((node) => {
          const direction = node.directionId ? directions[node.directionId] : null;
          const isConnectedToSelection =
            selectedNodeId !== null &&
            (node.id === selectedNodeId || node.parentNodeId === selectedNodeId);

          return {
            id: `e-${node.parentNodeId}-${node.id}`,
            source: node.parentNodeId!,
            target: node.id,
            style: {
              stroke: direction?.color ?? 'var(--edge-default)',
              strokeWidth: isConnectedToSelection ? 3 : 2,
              opacity:
                selectedNodeId === null || isConnectedToSelection ? 1 : 0.35,
            },
            animated: isConnectedToSelection,
            zIndex: isConnectedToSelection ? 12 : 1,
          };
        }),
    [directions, filteredNodeIds, filteredNodeList, selectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    selectNode(null);
  }, [selectNode]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<NodeData>) => {
      setContextMenu(null);
      selectNode(node.id);
    },
    [selectNode]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      event.preventDefault();
      setContextMenu({
        nodeId: node.id,
        position: getContextMenuPosition(event.clientX, event.clientY),
      });
    },
    []
  );

  const handleNodeDragStart: NodeDragHandler = useCallback(
    (_event, node) => {
      setContextMenu(null);
      selectNode(node.id);
      setRfNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, zIndex: 30 } : item
        )
      );
    },
    [selectNode]
  );

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const handleNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      setRfNodes((current) =>
        current.map((item) =>
          item.id === node.id
            ? {
                ...item,
                position: node.position,
                zIndex: selectedNodeId === node.id ? 20 : 0,
              }
            : item
        )
      );

      void updateNode(
        node.id,
        { position: node.position },
        {
          rollbackOnError: true,
          feedback: {
            action: 'position',
            savingMessage: '위치 저장 중...',
            successMessage: '위치가 저장되었습니다',
            errorMessage: '위치를 저장하지 못했습니다.',
          },
        }
      );
    },
    [selectedNodeId, updateNode]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (isDeletingNode) {
        return;
      }

      setIsDeletingNode(true);

      try {
        const deleted = await deleteNode(nodeId);
        if (deleted) {
          if (selectedNodeId === nodeId) {
            selectNode(null);
          }
          setDeleteTargetId(null);
        }
      } finally {
        setIsDeletingNode(false);
      }
    },
    [deleteNode, isDeletingNode, selectNode, selectedNodeId]
  );

  const deleteImpact = useMemo(() => {
    if (!deleteTargetNode) {
      return null;
    }

    const directChildrenCount = nodeList.filter(
      (node) => node.parentNodeId === deleteTargetNode.id
    ).length;
    const descendantCount = collectDescendantIds(nodeList, deleteTargetNode.id).size;

    return {
      directChildrenCount,
      descendantCount,
    };
  }, [deleteTargetNode, nodeList]);

  const contextMenuActions = useMemo<NodeContextMenuAction[]>(() => {
    if (!contextMenuNode) {
      return [];
    }

    return [
      {
        id: 'open-fullscreen',
        label: '\uD06C\uAC8C \uBCF4\uAE30',
        onSelect: () => {
          setFullscreenNodeId(contextMenuNode.id);
        },
      },
      {
        id: 'open-detail',
        label: '상세 보기',
        onSelect: () => {
          selectNode(contextMenuNode.id);
          setDetailMode('view');
        },
      },
      {
        id: 'open-variation',
        label: '변형 만들기',
        onSelect: () => {
          selectNode(contextMenuNode.id);
          setDetailMode('variation');
        },
      },
      {
        id: 'focus-parent',
        label: '상위로 이동',
        disabled: !contextMenuNode.parentNodeId,
        onSelect: () => {
          if (contextMenuNode.parentNodeId) {
            selectNode(contextMenuNode.parentNodeId);
          }
        },
      },
      {
        id: 'reparent',
        label: '상위 변경...',
        onSelect: () => {
          setReparentNodeId(contextMenuNode.id);
        },
      },
      {
        id: 'delete',
        label: '보관',
        tone: 'danger',
        onSelect: () => {
          setDeleteTargetId(contextMenuNode.id);
        },
      },
    ];
  }, [contextMenuNode, selectNode, setDetailMode]);

  return (
    <div
      className="relative h-full w-full"
      style={{ backgroundColor: 'var(--canvas-bg)' }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onMoveEnd={(_event, viewport) => setZoomLevel(viewport.zoom)}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        fitView={false}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        selectNodesOnDrag={false}
      >
        <Background color="var(--canvas-grid)" gap={20} size={1} />
        <Controls />
        <Panel position="top-left">
          <button
            className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onClick={() => setGenerateDialogOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            이미지 생성
          </button>
        </Panel>
      </ReactFlow>

      <DropOverlay visible={isDragging} />
      <ParentSelectDialog />
      <ReparentNodeDialog
        nodeId={reparentNodeId}
        onClose={() => setReparentNodeId(null)}
      />

      {contextMenu && contextMenuNode && (
        <NodeContextMenu
          position={contextMenu.position}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      )}

      <FullscreenImageViewer
        node={fullscreenNode}
        onClose={() => setFullscreenNodeId(null)}
      />

      <DestructiveActionDialog
        isOpen={Boolean(deleteTargetNode && deleteImpact)}
        title="이미지를 보관할까요?"
        description={
          deleteTargetNode
            ? `${deleteTargetLabel} 이미지를 보관합니다.`
            : ''
        }
        confirmLabel="이미지 보관"
        impacts={
          deleteTargetNode && deleteImpact
            ? [
                `직계 자식 ${deleteImpact.directChildrenCount}개`,
                `전체 후손 ${deleteImpact.descendantCount}개`,
                deleteTargetNode.directionId
                  ? '현재 브랜치 연결 정보가 함께 해제됩니다.'
                  : '미분류 이미지입니다.',
              ]
            : []
        }
        consequences={
          deleteTargetNode && deleteImpact
            ? [
                deleteImpact.directChildrenCount > 0
                  ? '직계 자식 이미지는 루트 이미지로 승격됩니다.'
                  : '연결 구조 변화는 없습니다.',
                '이 이미지의 메모, 상태, 프롬프트 로그는 보관함으로 이동합니다.',
              ]
            : []
        }
        isSubmitting={isDeletingNode}
        onClose={() => {
          if (!isDeletingNode) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() =>
          deleteTargetNode ? handleDeleteNode(deleteTargetNode.id) : undefined
        }
      />

      {nodeCount === 0 && !isDragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--text-muted)' }}>
            <svg
              className="mx-auto mb-3 h-12 w-12 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">이미지를 드래그해 작업을 시작해 보세요.</p>
            <p className="mt-1.5 text-[11px] opacity-60">
              또는 좌측 상단의 이미지 생성 버튼으로 첫 결과를 만들어 보세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function NodeGraph() {
  return (
    <ReactFlowProvider>
      <NodeGraphInner />
    </ReactFlowProvider>
  );
}

function syncFlowNodes(
  current: Node<NodeData>[],
  nodeList: NodeData[],
  selectedNodeId: string | null
) {
  const currentMap = new Map(current.map((node) => [node.id, node]));

  return nodeList.map((node) => {
    const existing = currentMap.get(node.id);
    const isSelected = selectedNodeId === node.id;

    return {
      id: node.id,
      type: 'imageNode',
      position: existing?.dragging ? existing.position : node.position,
      data: node,
      selected: isSelected,
      zIndex: existing?.dragging ? 30 : isSelected ? 20 : 0,
    };
  });
}

function getContextMenuPosition(clientX: number, clientY: number) {
  if (typeof window === 'undefined') {
    return { x: clientX, y: clientY };
  }

  return {
    x: Math.max(8, Math.min(clientX, window.innerWidth - 196)),
    y: Math.max(8, Math.min(clientY, window.innerHeight - 260)),
  };
}
