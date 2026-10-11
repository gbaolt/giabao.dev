export type ResumePdfDocumentFile = {
  data: Uint8Array;
};

export type ResumePdfFetch = (
  input: string,
  init?: { signal?: AbortSignal; cache?: RequestCache }
) => Promise<Response>;

export type ResumePdfLoadCommit = {
  aborted: boolean;
  requestSrc: string;
  requestGeneration: number;
  activeSrc: string;
  activeGeneration: number;
};

export async function fetchResumePdfBytes(
  src: string,
  options: {
    signal?: AbortSignal;
    cache?: RequestCache;
    fetch?: ResumePdfFetch;
  } = {}
): Promise<Uint8Array> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(src, {
    signal: options.signal,
    cache: options.cache,
  });

  if (!response.ok) {
    throw new Error(`Resume PDF download failed (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Resume PDF download was empty');
  }

  return new Uint8Array(buffer);
}

export function createResumePdfDocumentFile(
  bytes: Uint8Array
): ResumePdfDocumentFile {
  // PDF.js may transfer `data` into its worker. A slice keeps the owned copy
  // usable after Document remounts, retries, or cache reuse.
  return { data: bytes.slice() };
}

export function shouldApplyResumePdfLoad({
  aborted,
  requestSrc,
  requestGeneration,
  activeSrc,
  activeGeneration,
}: ResumePdfLoadCommit): boolean {
  return (
    !aborted &&
    requestSrc === activeSrc &&
    requestGeneration === activeGeneration
  );
}

export function isResumePdfLoadAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

export function toResumePdfLoadError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('Resume PDF download failed');
}
