import { expect, test } from 'bun:test';

import {
  createResumePdfDocumentFile,
  fetchResumePdfBytes,
  isResumePdfLoadAbort,
  shouldApplyResumePdfLoad,
  toResumePdfLoadError,
} from '../resume-pdf-source';

test('fetches owned bytes once and does not share the response buffer with Document', async () => {
  const payload = new Uint8Array([1, 2, 3, 4]);
  let calls = 0;
  const bytes = await fetchResumePdfBytes('/resume.pdf', {
    fetch: async (input) => {
      calls += 1;
      expect(input).toBe('/resume.pdf');
      return new Response(payload, { status: 200 });
    },
  });

  expect(calls).toBe(1);
  expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);

  const file = createResumePdfDocumentFile(bytes);
  expect(file.data.buffer).not.toBe(bytes.buffer);
  expect(Array.from(file.data)).toEqual([1, 2, 3, 4]);

  structuredClone(file.data, { transfer: [file.data.buffer] });
  expect(file.data.buffer.byteLength).toBe(0);
  expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);

  const retried = createResumePdfDocumentFile(bytes);
  expect(retried.data.buffer).not.toBe(bytes.buffer);
  expect(Array.from(retried.data)).toEqual([1, 2, 3, 4]);
});

test('a later attempt refetches instead of reusing earlier successful bytes', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(new Uint8Array(calls === 1 ? [1] : [2, 2]), {
      status: 200,
    });
  };

  const first = await fetchResumePdfBytes('/resume.pdf', { fetch: fetchImpl });
  const second = await fetchResumePdfBytes('/resume.pdf', { fetch: fetchImpl });

  expect(calls).toBe(2);
  expect(Array.from(first)).toEqual([1]);
  expect(Array.from(second)).toEqual([2, 2]);
  expect(first.buffer).not.toBe(second.buffer);
  expect(createResumePdfDocumentFile(second).data.buffer).not.toBe(
    first.buffer
  );
});

test('retries a failed download instead of reusing a rejected result', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('unavailable', { status: 503 });
    }
    return new Response(new Uint8Array([9]), { status: 200 });
  };

  await expect(
    fetchResumePdfBytes('/resume.pdf', { fetch: fetchImpl })
  ).rejects.toThrow('Resume PDF download failed (503)');
  expect(
    Array.from(await fetchResumePdfBytes('/resume.pdf', { fetch: fetchImpl }))
  ).toEqual([9]);
  expect(calls).toBe(2);
});

test('rejects an empty PDF body', async () => {
  await expect(
    fetchResumePdfBytes('/resume.pdf', {
      fetch: async () => new Response(new Uint8Array(), { status: 200 }),
    })
  ).rejects.toThrow('Resume PDF download was empty');
});

test('treats AbortError as a cancelled load', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(
    fetchResumePdfBytes('/resume.pdf', {
      signal: controller.signal,
      fetch: async (_input, init) => {
        if (init?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        return new Response(new Uint8Array([1]), { status: 200 });
      },
    })
  ).rejects.toMatchObject({ name: 'AbortError' });

  expect(isResumePdfLoadAbort(new DOMException('Aborted', 'AbortError'))).toBe(
    true
  );
  expect(isResumePdfLoadAbort(new Error('Resume PDF download failed'))).toBe(
    false
  );
});

test('ignores aborted, stale source, and stale generation completions', () => {
  expect(
    shouldApplyResumePdfLoad({
      aborted: true,
      requestSrc: '/resume.pdf',
      requestGeneration: 1,
      activeSrc: '/resume.pdf',
      activeGeneration: 1,
    })
  ).toBe(false);

  expect(
    shouldApplyResumePdfLoad({
      aborted: false,
      requestSrc: '/resume.pdf',
      requestGeneration: 1,
      activeSrc: '/other.pdf',
      activeGeneration: 1,
    })
  ).toBe(false);

  expect(
    shouldApplyResumePdfLoad({
      aborted: false,
      requestSrc: '/resume.pdf',
      requestGeneration: 1,
      activeSrc: '/resume.pdf',
      activeGeneration: 2,
    })
  ).toBe(false);

  expect(
    shouldApplyResumePdfLoad({
      aborted: false,
      requestSrc: '/resume.pdf',
      requestGeneration: 2,
      activeSrc: '/resume.pdf',
      activeGeneration: 2,
    })
  ).toBe(true);
});

test('source replacement aborts the older download', async () => {
  const older = Promise.withResolvers<Uint8Array>();
  let calls = 0;
  const fetchImpl = async (input: string, init?: { signal?: AbortSignal }) => {
    calls += 1;
    if (input === '/old.pdf') {
      const payload = await older.promise;
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return new Response(new Uint8Array(payload));
    }
    return new Response(new Uint8Array([2]), { status: 200 });
  };

  const firstController = new AbortController();
  const first = fetchResumePdfBytes('/old.pdf', {
    signal: firstController.signal,
    fetch: fetchImpl,
  });
  const second = await fetchResumePdfBytes('/new.pdf', { fetch: fetchImpl });

  firstController.abort();
  older.resolve(new Uint8Array([1]));

  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  expect(Array.from(second)).toEqual([2]);
  expect(calls).toBe(2);
  expect(
    shouldApplyResumePdfLoad({
      aborted: true,
      requestSrc: '/old.pdf',
      requestGeneration: 1,
      activeSrc: '/new.pdf',
      activeGeneration: 2,
    })
  ).toBe(false);
});

test('normalizes unknown load failures', () => {
  expect(toResumePdfLoadError('nope').message).toBe(
    'Resume PDF download failed'
  );
  const error = new Error('network down');
  expect(toResumePdfLoadError(error)).toBe(error);
});
