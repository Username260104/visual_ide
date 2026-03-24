'use client';

import { LayersIcon, GearIcon } from '@radix-ui/react-icons';
import { useUIStore } from '@/stores/uiStore';

export function ActivityBar() {
  const { activeSidebarTab, setActiveSidebarTab, isSidebarOpen, toggleSidebar } =
    useUIStore();

  const handleTabClick = (tab: 'directions' | 'settings') => {
    if (activeSidebarTab === tab && isSidebarOpen) {
      toggleSidebar();
    } else {
      setActiveSidebarTab(tab);
      if (!isSidebarOpen) toggleSidebar();
    }
  };

  return (
    <div
      className="flex flex-col items-center w-12 shrink-0 border-r py-2 gap-1"
      style={{
        backgroundColor: 'var(--activitybar-bg)',
        borderColor: 'var(--activitybar-border)',
      }}
    >
      <button
        onClick={() => handleTabClick('directions')}
        className="flex items-center justify-center w-10 h-10 rounded"
        style={{
          color:
            activeSidebarTab === 'directions' && isSidebarOpen
              ? 'var(--activitybar-fg)'
              : 'var(--activitybar-inactive)',
        }}
        title="Directions"
      >
        <LayersIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => handleTabClick('settings')}
        className="flex items-center justify-center w-10 h-10 rounded mt-auto"
        style={{
          color:
            activeSidebarTab === 'settings' && isSidebarOpen
              ? 'var(--activitybar-fg)'
              : 'var(--activitybar-inactive)',
        }}
        title="Settings"
      >
        <GearIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
