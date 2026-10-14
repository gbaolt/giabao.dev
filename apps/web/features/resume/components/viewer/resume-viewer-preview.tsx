'use client';

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useResumeViewerDocument } from '../../context/resume-viewer-provider';
import { ResumePdfSourceProvider } from '../../hooks/use-resume-pdf-source';
import { ResumeViewerPages, ResumeViewerViewport } from './resume-viewer';
import { ResumeViewerZoomShortcuts } from './resume-viewer-zoom-shortcuts';

const NATIVE_VIEWER_QUERY = '(min-width: 768px)';

function subscribeToViewport(callback: () => void) {
  const query = window.matchMedia(NATIVE_VIEWER_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function canUseNativeViewer() {
  return (
    navigator.pdfViewerEnabled && window.matchMedia(NATIVE_VIEWER_QUERY).matches
  );
}

function getServerSnapshot() {
  return null;
}

export function ResumeViewerPreview({ className }: { className?: string }) {
  const { src } = useResumeViewerDocument();
  const useNativeViewer = React.useSyncExternalStore(
    subscribeToViewport,
    canUseNativeViewer,
    getServerSnapshot
  );

  if (useNativeViewer === null) {
    return (
      <div
        className={cn(
          'h-[calc(100svh-var(--header-height)-var(--bottom-height))] w-full select-none!',
          className
        )}
        role="status"
      >
        <ResumeViewerPlaceholder />
      </div>
    );
  }

  if (useNativeViewer) {
    return (
      <iframe
        data-slot="resume-viewer-native"
        title="Resume PDF"
        src={`${src}#toolbar=1&navpanes=0`}
        className={cn(
          'block h-[calc(100svh-var(--top-height))] w-full bg-[#282828] select-none!',
          className
        )}
      />
    );
  }

  return <ResumeViewerFallback className={className} src={src} />;
}

function ResumeViewerFallback({
  className,
  src,
}: {
  className?: string;
  src: string;
}) {
  return (
    <ResumePdfSourceProvider src={src}>
      <ResumeViewerZoomShortcuts />
      <ResumeViewerViewport className={className}>
        <ResumeViewerPages />
      </ResumeViewerViewport>
    </ResumePdfSourceProvider>
  );
}

function ResumeViewerPlaceholder() {
  return (
    <div data-slot="resume-viewer-placeholder" className="h-full">
      <Skeleton className="size-full rounded-none" />
    </div>
  );
}
