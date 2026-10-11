'use client';

import type { VariantProps } from 'class-variance-authority';
import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import React from 'react';

import { NavigationPrefetchBoundary } from '@/components/layout/navigation/navigation-prefetch';
import { Button } from '@/components/ui/button';
import type { buttonGroupVariants } from '@/components/ui/button-group';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@/components/ui/button-group';
import { cn } from '@/lib/utils';

import {
  ResumeViewerProvider,
  useResumePreviewReady,
  useResumeViewer,
} from '../../context/resume-viewer-provider';
import { PdfPages } from '../pdf-pages';

/** Root: owns document URL, page count, and zoom. */
export function ResumeViewer({
  src,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { src: string }) {
  return (
    <ResumeViewerProvider src={src}>
      <div
        data-slot="resume-viewer"
        className={cn('flex flex-col', className)}
        {...props}
      >
        {children}
      </div>
    </ResumeViewerProvider>
  );
}

export function ResumeViewerToolbar({
  className,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  const { numPages, zoom, zoomIn, zoomOut, fitWidth } = useResumeViewer();

  const isLoaded = numPages > 0;
  const isFitWidth = zoom === 1;

  const separator = 'mt-px h-7.5!';

  return (
    <ButtonGroup
      data-slot="resume-viewer-toolbar"
      className={cn('overflow-y-hidden', className)}
      {...props}
    >
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={!isLoaded}
        onClick={zoomOut}
        className="-mr-px"
      >
        <ZoomOutIcon />
      </Button>
      <ButtonGroupSeparator className={separator} />
      <ButtonGroupText className="bg-secondary mt-px h-7.5 min-w-12 justify-center overflow-y-hidden border-transparent text-xs tabular-nums">
        {Math.round(zoom * 100)}%
      </ButtonGroupText>
      <ButtonGroupSeparator className={separator} />
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={!isLoaded}
        onClick={zoomIn}
        className="-mr-px"
      >
        <ZoomInIcon />
      </Button>
      <ButtonGroupSeparator className={separator} />
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Fit width"
        disabled={!isLoaded || isFitWidth}
        onClick={fitWidth}
      >
        <MaximizeIcon />
      </Button>
    </ButtonGroup>
  );
}

/** Fixed-height scroll box the pages stack inside. */
export function ResumeViewerViewport({
  className,
  onPointerDown,
  ...props
}: React.ComponentProps<'div'>) {
  const { zoom, viewportRef } = useResumeViewer();

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const page = viewport?.querySelector('[data-slot="resume-viewer-page"]');
    if (!viewport || !page) return;

    const viewportBounds = viewport.getBoundingClientRect();
    const pageBounds = page.getBoundingClientRect();

    viewport.scrollLeft +=
      pageBounds.left +
      pageBounds.width / 2 -
      (viewportBounds.left + viewport.clientLeft + viewport.clientWidth / 2);
  }, [zoom, viewportRef]);

  return (
    <div
      ref={viewportRef}
      data-slot="resume-viewer-viewport"
      role="region"
      aria-label="Resume PDF"
      tabIndex={0}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || event.button !== 0) return;

        const target = event.target;
        const interactive =
          target instanceof Element
            ? target.closest(
                'a[href], button, input, select, textarea, [contenteditable], [tabindex]'
              )
            : null;
        if (interactive && interactive !== event.currentTarget) return;

        event.currentTarget.focus({ preventScroll: true });
      }}
      className={cn(
        'bg-background aspect-3/4 min-h-120 w-full scrollbar-gutter-stable overflow-y-scroll p-4 outline-none',
        className
      )}
      {...props}
    />
  );
}

export function ResumeViewerPages() {
  const { isPreviewReady } = useResumePreviewReady();

  return (
    <div className="relative flex min-h-full w-full flex-col items-center-safe">
      <NavigationPrefetchBoundary ready={isPreviewReady} />
      {!isPreviewReady ? (
        <div
          className="absolute inset-0 z-10 size-full bg-white"
          role="status"
        />
      ) : null}
      <PdfPages />
    </div>
  );
}
