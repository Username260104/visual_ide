import { useState, useCallback, type DragEvent } from 'react';
import { useReactFlow } from 'reactflow';
import { fetchJson } from '@/lib/clientApi';
import { useNodeStore } from '@/stores/nodeStore';
import { useUIStore } from '@/stores/uiStore';

export function useImageDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useNodeStore((s) => s.addNode);
  const nodes = useNodeStore((s) => s.nodes);
  const projectId = useNodeStore((s) => s.projectId);
  const setPendingDrop = useUIStore((s) => s.setPendingDrop);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );

      if (files.length === 0) return;
      if (!projectId) {
        console.error('Cannot upload images without a loaded project.');
        return;
      }

      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const uploads = await Promise.allSettled(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          formData.append('projectId', projectId);

          const data = await fetchJson<{ imageUrl: string }>(
            '/api/upload-image',
            {
              method: 'POST',
              body: formData,
            }
          );

          return data.imageUrl;
        })
      );

      const imageUrls = uploads.flatMap((result) => {
        if (result.status === 'fulfilled') {
          return [result.value];
        }

        console.error('Failed to upload image:', result.reason);
        return [];
      });

      if (imageUrls.length === 0) return;

      const hasExistingNodes = Object.keys(nodes).length > 0;

      if (hasExistingNodes) {
        // Show parent selection dialog
        setPendingDrop({ imageUrls, position });
      } else {
        // No nodes exist — create root nodes directly
        await Promise.all(
          imageUrls.map((url, i) =>
            addNode({
            imageUrl: url,
            source: 'imported',
            position: {
              x: position.x + i * 180,
              y: position.y,
            },
            })
          )
        );
      }
    },
    [screenToFlowPosition, addNode, nodes, projectId, setPendingDrop]
  );

  return { isDragging, onDragOver, onDragLeave, onDrop };
}
