'use client';

import { useNodeStore } from '@/stores/nodeStore';
import { useDirectionStore } from '@/stores/directionStore';
import { useUIStore } from '@/stores/uiStore';

export function StatusBar() {
  const nodeCount = useNodeStore((s) => Object.keys(s.nodes).length);
  const directionCount = useDirectionStore(
    (s) => Object.keys(s.directions).length
  );
  const zoomLevel = useUIStore((s) => s.zoomLevel);

  return (
    <div
      className="flex items-center h-6 px-3 text-xs shrink-0 gap-4"
      style={{
        backgroundColor: 'var(--statusbar-bg)',
        color: 'var(--statusbar-fg)',
      }}
    >
      <span>노드 {nodeCount}개</span>
      <span>방향 {directionCount}개</span>
      <span className="ml-auto">{Math.round(zoomLevel * 100)}%</span>
    </div>
  );
}
