import { expect, test } from 'bun:test';

import { createResumePdfCache } from '../development-resume-pdf';

test('shares rendering across concurrent requests and reuses unchanged output', async () => {
  let renders = 0;
  const pdf = new Uint8Array([1, 2, 3]);
  const getPdf = createResumePdfCache(async () => {
    renders++;
    return pdf;
  });

  expect(await Promise.all([getPdf('first'), getPdf('first')])).toEqual([
    pdf,
    pdf,
  ]);
  expect(await getPdf('first')).toBe(pdf);
  expect(renders).toBe(1);

  await getPdf('edited');
  expect(renders).toBe(2);
});

test('retries a failed render rather than caching the failure', async () => {
  let renders = 0;
  const pdf = new Uint8Array([1]);
  const getPdf = createResumePdfCache(async () => {
    if (++renders === 1) throw new Error('Render failed');
    return pdf;
  });

  await expect(getPdf('first')).rejects.toThrow('Render failed');
  expect(await getPdf('first')).toBe(pdf);
  expect(renders).toBe(2);
});

test('a failed older render does not discard the newer cached PDF', async () => {
  const older = Promise.withResolvers<Uint8Array>();
  const pdf = new Uint8Array([2]);
  let renders = 0;
  const getPdf = createResumePdfCache(async () => {
    return ++renders === 1 ? older.promise : pdf;
  });

  const firstRequest = getPdf('first');
  expect(await getPdf('edited')).toBe(pdf);
  older.reject(new Error('Old render failed'));
  await expect(firstRequest).rejects.toThrow('Old render failed');

  expect(await getPdf('edited')).toBe(pdf);
  expect(renders).toBe(2);
});
