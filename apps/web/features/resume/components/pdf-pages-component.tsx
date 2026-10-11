'use client';

import '@/lib/pdf-worker';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../styles/pdf-text-layer.css';

import React from 'react';
import { Document, Page } from 'react-pdf';

import { cn } from '@/lib/utils';

import {
  useResumePreviewReady,
  useResumeViewer,
  useResumeViewerDocument,
} from '../context/resume-viewer-provider';
import { useScheduledPageCanvas } from '../hooks/use-scheduled-page-canvas';
import {
  useDevicePixelRatio,
  useIsMobileViewport,
  useSettledPageRaster,
} from '../hooks/use-settled-page-raster';
import {
  getPageRasterScale,
  type PageRasterTarget,
  RESUME_PAGE_ASPECT_RATIO,
  RESUME_PAGE_MAX_DISPLAY_WIDTH_PX,
} from '../lib/page-raster-policy';
import { createResumePdfDocumentFile } from '../lib/resume-pdf-source';
import { ResumeViewerError } from './viewer/resume-viewer-error';

const PAGE_GAP_PX = 16;
const WIDTH_SNAP_PX = 4;

function getAnnotationLabel(href: string) {
  try {
    const url = new URL(href);
    return `Open link to ${url.hostname}`;
  } catch {
    return 'Open PDF link';
  }
}

function useStableWidth(elementRef: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const read = () => {
      const next = Math.floor(element.getBoundingClientRect().width);

      setWidth((current) => {
        if (next <= 0) return current;
        if (current === 0) return next;
        if (next >= current && next - current < WIDTH_SNAP_PX) return current;
        return next;
      });
    };

    read();

    const observer = new ResizeObserver(read);
    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef]);

  return width;
}

export function PdfPages({
  bytes,
  onRetry,
}: {
  bytes: Uint8Array | null;
  onRetry: () => void;
}) {
  const { src, setNumPages } = useResumeViewerDocument();
  const { setPreviewReady } = useResumePreviewReady();
  const { zoom } = useResumeViewer();
  const sizerRef = React.useRef<HTMLDivElement>(null);
  const sizerWidth = useStableWidth(sizerRef);
  const fitWidth = Math.min(sizerWidth, RESUME_PAGE_MAX_DISPLAY_WIDTH_PX);
  const displayedWidthPx = Math.max(0, Math.floor(fitWidth * zoom));
  const devicePixelRatio = useDevicePixelRatio();
  const isMobileViewport = useIsMobileViewport();

  return (
    <div className="flex min-h-full w-full flex-col items-center">
      <div ref={sizerRef} className="w-full max-w-225" />
      {displayedWidthPx > 0 && bytes ? (
        <PdfPagesDocument
          src={src}
          bytes={bytes}
          onRetry={onRetry}
          displayedWidthPx={displayedWidthPx}
          devicePixelRatio={devicePixelRatio}
          isMobileViewport={isMobileViewport}
          setNumPages={setNumPages}
          setPreviewReady={setPreviewReady}
        />
      ) : null}
    </div>
  );
}

function PdfPagesDocument({
  src,
  bytes,
  onRetry,
  displayedWidthPx,
  devicePixelRatio,
  isMobileViewport,
  setNumPages,
  setPreviewReady,
}: {
  src: string;
  bytes: Uint8Array;
  onRetry: () => void;
  displayedWidthPx: number;
  devicePixelRatio: number;
  isMobileViewport: boolean;
  setNumPages: (numPages: number) => void;
  setPreviewReady: (ready: boolean) => void;
}) {
  const raster = useSettledPageRaster({
    displayedWidthPx,
    devicePixelRatio,
    isMobileViewport,
  });

  return (
    <div
      className="flex w-full flex-col items-center"
      style={
        {
          '--resume-page-width': `${displayedWidthPx}px`,
        } as React.CSSProperties
      }
    >
      <PdfDocument
        key={src}
        bytes={bytes}
        onRetry={onRetry}
        displayedWidthPx={displayedWidthPx}
        raster={raster}
        setNumPages={setNumPages}
        setPreviewReady={setPreviewReady}
      />
    </div>
  );
}

function PdfDocument({
  bytes,
  onRetry,
  displayedWidthPx,
  raster,
  setNumPages,
  setPreviewReady,
}: {
  bytes: Uint8Array;
  onRetry: () => void;
  displayedWidthPx: number;
  raster: PageRasterTarget;
  setNumPages: (numPages: number) => void;
  setPreviewReady: (ready: boolean) => void;
}) {
  const [loadedPages, setLoadedPages] = React.useState(0);
  const file = React.useMemo(() => createResumePdfDocumentFile(bytes), [bytes]);

  const settleDocumentError = React.useCallback(() => {
    setNumPages(0);
    setPreviewReady(true);
  }, [setNumPages, setPreviewReady]);

  const retry = React.useCallback(() => {
    setLoadedPages(0);
    setNumPages(0);
    onRetry();
  }, [onRetry, setNumPages]);

  const settleFirstPage = React.useCallback(() => {
    setPreviewReady(true);
  }, [setPreviewReady]);

  return (
    <Document
      file={file}
      suspense={false}
      className="flex w-full flex-col items-center-safe"
      loading={null}
      error={<ResumeViewerError onRetry={retry} />}
      externalLinkTarget="_blank"
      externalLinkRel="noopener noreferrer"
      onLoadSuccess={(pdf) => {
        setLoadedPages(pdf.numPages);
        setNumPages(pdf.numPages);
      }}
      onLoadError={settleDocumentError}
      onSourceError={settleDocumentError}
    >
      <div
        data-slot="resume-viewer-pages"
        className="flex flex-col items-center"
        style={{ gap: PAGE_GAP_PX }}
      >
        {Array.from({ length: loadedPages }, (_, index) => {
          const pageNumber = index + 1;

          return (
            <PdfPage
              key={pageNumber}
              pageNumber={pageNumber}
              displayedWidthPx={displayedWidthPx}
              raster={raster}
              onFirstPageSettled={
                pageNumber === 1 ? settleFirstPage : undefined
              }
              onRetry={retry}
            />
          );
        })}
      </div>
    </Document>
  );
}

function PdfPage({
  pageNumber,
  displayedWidthPx,
  raster,
  onFirstPageSettled,
  onRetry,
}: {
  pageNumber: number;
  displayedWidthPx: number;
  raster: PageRasterTarget;
  onFirstPageSettled?: () => void;
  onRetry: () => void;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const hasCanvas = useScheduledPageCanvas(pageNumber, frameRef);
  // Keep the Page and its interaction layers mounted while only raster density changes.
  const [layerWidthPx] = React.useState(raster.rasterWidthPx);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const lastRasterKeyRef = React.useRef<string | null>(null);
  const rasterKey = `${raster.rasterWidthPx}:${raster.devicePixelRatio}`;
  const [overlayActive, setOverlayActive] = React.useState(false);

  React.useLayoutEffect(() => {
    // react-pdf hides and resizes its canvas in useEffect, so copy first.
    const previousKey = lastRasterKeyRef.current;
    lastRasterKeyRef.current = rasterKey;
    if (previousKey === null || previousKey === rasterKey) return;

    const source = pageRef.current?.querySelector('canvas');
    const overlay = overlayRef.current;
    if (!source || !overlay || source.width === 0 || source.height === 0) {
      return;
    }

    copyCanvasPixels(source, overlay);
    setOverlayActive(true);
  }, [rasterKey]);

  const nameAnnotationLinks = () => {
    pageRef.current
      ?.querySelectorAll<HTMLAnchorElement>('a[href]')
      .forEach((link) => {
        if (link.textContent?.trim() || link.getAttribute('aria-label')) return;
        link.setAttribute('aria-label', getAnnotationLabel(link.href));
      });
  };

  const dismissOverlay = () => {
    releaseCanvasBacking(overlayRef.current);
    setOverlayActive(false);
  };

  const handleRenderSuccess = () => {
    dismissOverlay();
    onFirstPageSettled?.();
  };

  const handleRenderFailure = () => {
    dismissOverlay();
    onFirstPageSettled?.();
  };

  return (
    <div
      ref={frameRef}
      data-slot="resume-viewer-page"
      data-page-number={pageNumber}
      data-displayed-width={displayedWidthPx}
      data-raster-width={raster.rasterWidthPx}
      data-device-pixel-ratio={raster.devicePixelRatio}
      data-backing-width={raster.backingWidthPx}
      data-backing-height={raster.backingHeightPx}
      className="relative overflow-hidden bg-white shadow-sm"
      style={{
        width: 'var(--resume-page-width)',
        aspectRatio: RESUME_PAGE_ASPECT_RATIO,
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: layerWidthPx,
          transform: `scale(${getPageRasterScale(displayedWidthPx, layerWidthPx)})`,
        }}
      >
        <Page
          renderMode={hasCanvas ? 'canvas' : 'none'}
          pageNumber={pageNumber}
          width={layerWidthPx}
          devicePixelRatio={raster.backingWidthPx / layerWidthPx}
          suspense={false}
          inputRef={pageRef}
          loading={null}
          error={<ResumeViewerError onRetry={onRetry} compact />}
          onRenderSuccess={handleRenderSuccess}
          onRenderError={handleRenderFailure}
          onLoadError={handleRenderFailure}
          onRenderAnnotationLayerSuccess={nameAnnotationLinks}
        />
      </div>
      <canvas
        ref={overlayRef}
        aria-hidden
        width={0}
        height={0}
        className={cn(
          'pointer-events-none absolute inset-0 size-full',
          overlayActive ? null : 'invisible'
        )}
      />
    </div>
  );
}

function copyCanvasPixels(
  source: HTMLCanvasElement,
  destination: HTMLCanvasElement
) {
  destination.width = source.width;
  destination.height = source.height;
  destination.getContext('2d')?.drawImage(source, 0, 0);
}

function releaseCanvasBacking(canvas: HTMLCanvasElement | null) {
  if (!canvas || (canvas.width === 0 && canvas.height === 0)) return;
  canvas.width = 0;
  canvas.height = 0;
}
