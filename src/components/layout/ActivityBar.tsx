'use client';

import {
  Archive,
  ArrowLeftRight,
  Compass,
  GitBranch,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { SidebarTab, useUIStore } from '@/stores/uiStore';

const SIDEBAR_TABS: Array<{
  id: SidebarTab;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'image-bridge', label: '이미지 브릿지', icon: ArrowLeftRight },
  { id: 'branches', label: '브랜치', icon: GitBranch },
  { id: 'strategy', label: '전략', icon: Compass },
  { id: 'activity', label: '기록', icon: ScrollText },
  { id: 'archive', label: '보관함', icon: Archive },
];

export function ActivityBar() {
  const { activeSidebarTab, setActiveSidebarTab, isSidebarOpen, toggleSidebar } =
    useUIStore();

  const handleTabClick = (tab: SidebarTab) => {
    if (activeSidebarTab === tab && isSidebarOpen) {
      toggleSidebar();
    } else {
      setActiveSidebarTab(tab);
      if (!isSidebarOpen) toggleSidebar();
    }
  };

  return (
    <div
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2"
      style={{
        backgroundColor: 'var(--activitybar-bg)',
        borderColor: 'var(--activitybar-border)',
      }}
    >
      {SIDEBAR_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeSidebarTab === tab.id && isSidebarOpen;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className="flex h-10 w-10 items-center justify-center rounded transition-colors"
            style={{
              color: isActive
                ? 'var(--activitybar-fg)'
                : 'var(--activitybar-inactive)',
              backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
            }}
            title={tab.label}
            aria-label={tab.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
