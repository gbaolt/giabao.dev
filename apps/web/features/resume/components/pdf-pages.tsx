'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import { useResumePreviewReady } from '../context/resume-viewer-provider';
import { useResumePdfSourceState } from '../hooks/use-resume-pdf-source';
import { ResumeViewerError } from './viewer/resume-viewer-error';

const LazyPdfPages = dynamic(
  () => import('./pdf-pages-component').then((module) => module.PdfPages),
  { ssr: false }
);

export function PdfPages() {
  const source = useResumePdfSourceState();
  const { setPreviewReady } = useResumePreviewReady();

  React.useLayoutEffect(() => {
    if (source.status === 'error') setPreviewReady(true);
  }, [source.status, setPreviewReady]);

  const retry = () => {
    setPreviewReady(false);
    source.retry();
  };

  if (source.status === 'error') {
    return <ResumeViewerError onRetry={retry} />;
  }

  return <LazyPdfPages bytes={source.bytes} onRetry={retry} />;
}
