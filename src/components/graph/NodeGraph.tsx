'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { NodeData } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';
import { useImageDrop } from '@/hooks/useImageDrop';
import { DropOverlay } from './DropOverlay';
import { ImageNode } from './ImageNode';
import { NodeContextMenu, type NodeContextMenuAction } from './NodeContextMenu';
import { ParentSelectDialog } from './ParentSelectDialog';
import { ReparentNodeDialog } from './ReparentNodeDialog';

const nodeTypes: NodeTypes = {
  imageNode: ImageNode,
};

function NodeGraphInner() {
  const setZoomLevel = useUIStore((state) => state.setZoomLevel);
  const selectNode = useUIStore((state) => state.selectNode);
  const setDetailMode = useUIStore((state) => state.setDetailMode);
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const nodesById = useNodeStore((state) => state.nodes);
  const deleteNode = useNodeStore((state) => state.deleteNode);
  const updateNode = useNodeStore((state) => state.updateNode);
  const directions = useDirectionStore((state) => state.directions);
  const { isDragging, onDragOver, onDragLeave, onDrop } = useImageDrop();

  const nodeList = useMemo(() => Object.values(nodesById), [nodesById]);
  const nodeCount = nodeList.length;
  const [rfNodes, setRfNodes] = useState<Node<NodeData>[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [reparentNodeId, setReparentNodeId] = useState<string | null>(null);
  const contextMenuNode = contextMenu ? nodesById[contextMenu.nodeId] : null;

  useEffect(() => {
    setRfNodes((current) => syncFlowNodes(current, nodeList, selectedNodeId));
  }, [nodeList, selectedNodeId]);

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
    if (contextMenu && !nodesById[contextMenu.nodeId]) {
      setContextMenu(null);
    }

    if (reparentNodeId && !nodesById[reparentNodeId]) {
      setReparentNodeId(null);
    }
  }, [contextMenu, nodesById, reparentNodeId]);

  const rfEdges: Edge[] = useMemo(
    () =>
      nodeList
        .filter((node) => node.parentNodeId !== null)
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
    [directions, nodeList, selectedNodeId]
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
      setRfNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, zIndex: 30 } : item
        )
      );
    },
    []
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
      updateNode(node.id, { position: node.position });
    },
    [selectedNodeId, updateNode]
  );

  const contextMenuActions = useMemo<NodeContextMenuAction[]>(() => {
    if (!contextMenuNode) {
      return [];
    }

    return [
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
        label: '부모로 이동',
        disabled: !contextMenuNode.parentNodeId,
        onSelect: () => {
          if (contextMenuNode.parentNodeId) {
            selectNode(contextMenuNode.parentNodeId);
          }
        },
      },
      {
        id: 'reparent',
        label: '부모 변경...',
        onSelect: () => {
          setReparentNodeId(contextMenuNode.id);
        },
      },
      {
        id: 'delete',
        label: '삭제',
        tone: 'danger',
        onSelect: () => {
          if (!window.confirm('이 노드를 삭제할까요?')) {
            return;
          }
          if (selectedNodeId === contextMenuNode.id) {
            selectNode(null);
          }
          deleteNode(contextMenuNode.id);
        },
      },
    ];
  }, [
    contextMenuNode,
    deleteNode,
    selectNode,
    selectedNodeId,
    setDetailMode,
  ]);

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
        proOptions={{ hideAttribution: true }}
        selectNodesOnDrag={false}
      >
        <Background color="var(--canvas-grid)" gap={20} size={1} />
        <Controls />
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
            <p className="text-sm">이미지를 드래그해서 시작해 보세요.</p>
            <p className="mt-1.5 text-[11px] opacity-60">
              또는 사이드바에서 AI 생성으로 첫 이미지를 만들어도 됩니다.
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
