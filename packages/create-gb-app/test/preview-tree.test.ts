import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { previewTree } from '#/preview/tree';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

for (const [flags, tree] of [
  [
    { frontend: 'tanstack-start', api: 'none', database: 'sqlite', orm: 'drizzle', auth: 'none' },
    'src/routes\nsrc/server\npackage.json',
  ],
  [
    { frontend: 'tanstack-start', api: 'trpc', orm: 'prisma', auth: 'better-auth' },
    'src/routes\nsrc/server\nprisma\npackage.json',
  ],
  [{ frontend: 'next', auth: 'better-auth' }, 'app\nlib\nprisma\npackage.json'],
] satisfies [RawFlags, string][]) {
  test(`previews only paths the generator writes for ${JSON.stringify(flags)}`, () => {
    const stack = resolveStack(flags);
    const paths = Object.keys(
      buildTree(stack, { projectName: 'preview-app', packageManager: 'bun' })
    );

    expect(previewTree(stack)).toBe(tree);
    for (const row of tree.split('\n'))
      expect([row, paths.some((path) => path === row || path.startsWith(`${row}/`))]).toEqual([row, true]);
  });
}
