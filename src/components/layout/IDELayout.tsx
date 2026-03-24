'use client';

import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { DetailPanel } from '@/components/detail/DetailPanel';
import { GenerateDialog } from './GenerateDialog';

export function IDELayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        <ActivityBar />
        <Sidebar />
        {/* Center: graph canvas */}
        <div className="flex-1 min-w-0 relative">{children}</div>
        {/* Right: detail panel */}
        <DetailPanel />
      </div>
      <StatusBar />
      <GenerateDialog />
    </div>
  );
}
