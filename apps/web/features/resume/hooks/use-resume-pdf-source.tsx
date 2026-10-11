'use client';

import React from 'react';

import {
  useResumePreviewReady,
  useResumeViewerDocument,
} from '../context/resume-viewer-provider';
import {
  fetchResumePdfBytes,
  isResumePdfLoadAbort,
  shouldApplyResumePdfLoad,
} from '../lib/resume-pdf-source';

export type ResumePdfSourceStatus = 'loading' | 'ready' | 'error';

export type ResumePdfSourceValue = {
  status: ResumePdfSourceStatus;
  bytes: Uint8Array | null;
  retry: () => void;
};

type ResumePdfSourceState = {
  src: string;
  attempt: number;
  status: ResumePdfSourceStatus;
  bytes: Uint8Array | null;
};

const ResumePdfSourceContext = React.createContext<ResumePdfSourceValue | null>(
  null
);

export function useResumePdfSourceState() {
  const context = React.use(ResumePdfSourceContext);

  if (!context) {
    throw new Error(
      'Resume PDF source must be read inside <ResumePdfSourceProvider>'
    );
  }

  return context;
}

export function ResumePdfSourceProvider({
  src,
  children,
}: {
  src: string;
  children: React.ReactNode;
}) {
  const value = useResumePdfSource(src);
  const { setPreviewReady } = useResumePreviewReady();
  const { setNumPages } = useResumeViewerDocument();

  React.useLayoutEffect(() => {
    if (value.status === 'loading') {
      setPreviewReady(false);
      setNumPages(0);
    }
  }, [value.status, setPreviewReady, setNumPages]);

  return (
    <ResumePdfSourceContext value={value}>{children}</ResumePdfSourceContext>
  );
}

function useResumePdfSource(src: string): ResumePdfSourceValue {
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<ResumePdfSourceState>({
    src,
    attempt: 0,
    status: 'loading',
    bytes: null,
  });

  if (state.src !== src || state.attempt !== attempt) {
    setState({ src, attempt, status: 'loading', bytes: null });
  }

  const current =
    state.src === src && state.attempt === attempt
      ? state
      : { src, attempt, status: 'loading' as const, bytes: null };

  React.useLayoutEffect(() => {
    const controller = new AbortController();
    const requestSrc = src;
    const requestGeneration = attempt;

    void fetchResumePdfBytes(requestSrc, {
      signal: controller.signal,
      cache: attempt > 0 ? 'reload' : undefined,
    })
      .then((bytes) => {
        if (
          !shouldApplyResumePdfLoad({
            aborted: controller.signal.aborted,
            requestSrc,
            requestGeneration,
            activeSrc: src,
            activeGeneration: attempt,
          })
        ) {
          return;
        }

        setState({
          src: requestSrc,
          attempt: requestGeneration,
          status: 'ready',
          bytes,
        });
      })
      .catch((error: unknown) => {
        if (
          isResumePdfLoadAbort(error) ||
          !shouldApplyResumePdfLoad({
            aborted: controller.signal.aborted,
            requestSrc,
            requestGeneration,
            activeSrc: src,
            activeGeneration: attempt,
          })
        ) {
          return;
        }

        setState({
          src: requestSrc,
          attempt: requestGeneration,
          status: 'error',
          bytes: null,
        });
      });

    return () => {
      controller.abort();
    };
  }, [attempt, src]);

  const retry = React.useCallback(() => {
    // Drop owned bytes so a 200 that parsed as garbage cannot trap retry.
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  return React.useMemo(
    () => ({
      status: current.status,
      bytes: current.bytes,
      retry,
    }),
    [current.bytes, current.status, retry]
  );
}
