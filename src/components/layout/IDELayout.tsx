'use client';

import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { DetailPanel } from '@/components/detail/DetailPanel';
import { StagingNavigationGuard } from '@/components/staging/StagingNavigationGuard';
import { StagingTray } from '@/components/staging/StagingTray';
import { WORKSPACE_MODAL_TARGET_ID } from '@/components/ui/ModalShell';
import { GenerateDialog } from './GenerateDialog';

export function IDELayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <StagingNavigationGuard />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <Sidebar />
        <div id={WORKSPACE_MODAL_TARGET_ID} className="relative min-w-0 flex-1">
          {children}
        </div>
        <DetailPanel />
      </div>
      <StagingTray />
      <StatusBar />
      <GenerateDialog />
    </div>
  );
}
