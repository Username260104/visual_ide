'use client';

export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: 'rgba(0, 122, 204, 0.08)',
        border: '2px dashed var(--border-focus)',
      }}
    >
      <div
        className="px-6 py-3 rounded text-sm font-medium"
        style={{
          backgroundColor: 'var(--bg-overlay)',
          color: 'var(--text-accent)',
          border: '1px solid var(--border-focus)',
        }}
      >
        이미지를 여기에 드롭하세요
      </div>
    </div>
  );
}
