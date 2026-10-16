import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { expect, test } from 'bun:test';
import * as prettier from 'prettier';

import { buildTree, type RawFlags, resolveStack } from '#/generate/public';

const cases = {
  'next-default': { yes: true },
  'next-rhf': { yes: true, form: 'react-hook-form' },
  'next-tanstack-form': { yes: true, form: 'tanstack-form' },
  'next-shell': { database: 'none', api: 'none', auth: 'none' },
  'start-public': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
  },
  'start-private': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
  },
  'start-rhf': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    form: 'react-hook-form',
  },
  'start-tanstack-form': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    form: 'tanstack-form',
  },
  'hono-next-rhf': {
    backend: 'hono',
    api: 'trpc',
    auth: 'none',
    form: 'react-hook-form',
  },
  'hono-start-tanstack-form': {
    backend: 'hono',
    frontend: 'tanstack-start',
    api: 'trpc',
    auth: 'none',
    form: 'tanstack-form',
  },
  nest: { backend: 'nest' },
} satisfies Record<string, RawFlags>;

const options = await prettier.resolveConfig(
  resolve(import.meta.dir, '../../../.prettierrc')
);

for (const [name, flags] of Object.entries(cases)) {
  test(`template migration preserves ${name} output`, async () => {
    const files = buildTree(resolveStack(flags), {
      projectName: 'template-check',
      packageManager: 'bun',
    });
    const hashes: Record<string, string> = {};
    for (const path of Object.keys(files).sort()) {
      const source = files[path];
      const canonical = /\.(ts|tsx|mjs|css|json)$/.test(path)
        ? await prettier.format(source, { ...options, filepath: path })
        : source;
      hashes[path] = createHash('sha256').update(canonical).digest('hex');
    }
    expect(hashes).toMatchSnapshot();
  });
}
