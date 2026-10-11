'use client';

import React from 'react';

import {
  useResumePreviewReady,
  useResumeViewer,
} from '../context/resume-viewer-provider';

export function useScheduledPageCanvas(
  pageNumber: number,
  pageRef: React.RefObject<HTMLDivElement | null>
) {
  const { viewportRef } = useResumeViewer();
  const { isPreviewReady } = useResumePreviewReady();
  const [hasCanvas, setHasCanvas] = React.useState(pageNumber === 1);

  React.useLayoutEffect(() => {
    if (hasCanvas || !isPreviewReady) return;
    const viewport = viewportRef.current;
    const page = pageRef.current;
    if (!viewport || !page) return;

    const prepare = (margin: number) => {
      const viewportBounds = viewport.getBoundingClientRect();
      const pageBounds = page.getBoundingClientRect();
      const top = viewportBounds.top + viewport.clientTop;
      const bottom = top + viewport.clientHeight;
      if (
        pageBounds.bottom > top - margin &&
        pageBounds.top < bottom + margin
      ) {
        setHasCanvas(true);
      }
    };

    // Observe actual visibility at rest; scrolling opts into preparing ahead.
    prepare(0);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setHasCanvas(true);
      },
      { root: viewport }
    );
    observer.observe(page);

    const onScroll = () => prepare(Math.min(160, viewport.clientHeight * 0.35));
    const onFocus = () => setHasCanvas(true);
    viewport.addEventListener('scroll', onScroll, { passive: true });
    page.addEventListener('focusin', onFocus);

    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', onScroll);
      page.removeEventListener('focusin', onFocus);
    };
  }, [hasCanvas, isPreviewReady, pageRef, viewportRef]);

  return hasCanvas;
}
