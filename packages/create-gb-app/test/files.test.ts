import { expect, test } from 'bun:test';

import { setFile, writeOnceFiles } from '#/generate/files';
import type { EmitCtx } from '#/types/generate';

/** A fixture emit module that writes one owned path twice. */
function emitTwice(ctx: Pick<EmitCtx, 'files'>): void {
  setFile(ctx.files, 'src/owned.ts', 'export const first = 1;\n');
  setFile(ctx.files, 'src/owned.ts', 'export const second = 2;\n');
}

test('a second write to an owned path throws', () => {
  const files: Record<string, string> = {};

  expect(() => emitTwice({ files: writeOnceFiles(files) })).toThrow(
    'src/owned.ts already has a writer'
  );
  expect(files).toEqual({ 'src/owned.ts': 'export const first = 1;\n' });
});

test('emit modules cannot read files other modules wrote', () => {
  const files = writeOnceFiles({ 'app/layout.tsx': 'layout\n' });

  expect(() => files['app/layout.tsx']).toThrow('cannot read app/layout.tsx');
  expect(() => 'app/layout.tsx' in files).toThrow('cannot read');
  expect(() => Object.keys(files)).toThrow('cannot read');
});
