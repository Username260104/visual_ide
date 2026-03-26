'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNodeStore } from '@/stores/nodeStore';
import { useStagingStore } from '@/stores/stagingStore';
import { StagingWarningDialog } from './StagingWarningDialog';

export function StagingNavigationGuard() {
  const router = useRouter();
  const projectId = useNodeStore((state) => state.projectId);
  const batches = useStagingStore((state) => state.batches);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const stagedCandidateCount = useMemo(() => {
    if (!projectId) {
      return 0;
    }

    return batches.reduce((count, batch) => {
      if (batch.projectId !== projectId) {
        return count;
      }

      return (
        count +
        batch.candidates.filter((candidate) => candidate.status === 'staged').length
      );
    }, 0);
  }, [batches, projectId]);

  useEffect(() => {
    if (stagedCandidateCount === 0) {
      setPendingHref(null);
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stagedCandidateCount]);

  useEffect(() => {
    if (stagedCandidateCount === 0) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const eventTarget = event.target;
      if (!(eventTarget instanceof Element)) {
        return;
      }

      const anchor = eventTarget.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) {
        return;
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextLocation === currentLocation) {
        return;
      }

      event.preventDefault();
      setPendingHref(nextLocation);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [stagedCandidateCount]);

  return (
    <StagingWarningDialog
      isOpen={pendingHref !== null}
      title="staging 후보를 남긴 채 이동할까요?"
      description="아직 캔버스에 채택하지 않은 후보가 있어, 이동 전에 한 번 더 확인합니다."
      confirmLabel="이동하기"
      impacts={
        stagedCandidateCount > 0
          ? [`현재 프로젝트에 staging 후보 ${stagedCandidateCount}개가 남아 있습니다.`]
          : []
      }
      consequences={[
        '이 후보들은 아직 데이터베이스에 노드로 저장되지 않았습니다.',
        '현재 탭 메모리에만 남아 있으며, 새로고침하거나 탭을 닫으면 사라질 수 있습니다.',
      ]}
      onClose={() => setPendingHref(null)}
      onConfirm={() => {
        if (!pendingHref) {
          return;
        }

        router.push(pendingHref);
        setPendingHref(null);
      }}
    />
  );
}
