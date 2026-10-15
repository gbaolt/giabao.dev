import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { resolveStack } from '#/stack/resolve';
const CONVEX_FLAGS = {
  frontend: 'tanstack-start',
  backend: 'convex',
  auth: 'clerk',
  addons: {
    linting: 'eslint',
  },
} as const;
test('buildTree Convex golden has convex/ and no prisma', () => {
  const started = performance.now();
  const files = buildTree(resolveStack(CONVEX_FLAGS), {
    projectName: 'convex-app',
    packageManager: 'bun',
  });
  const ms = performance.now() - started;
  console.log(`buildTree convex ${ms.toFixed(2)}ms`);
  expect(ms).toBeLessThan(4000);
  expect(files['convex/schema.ts']).toBeDefined();
  expect(files['convex/notes.ts']).toContain('export const list');
  expect(files['convex/notes.ts']).toContain('export const create');
  expect(files['prisma/schema.prisma']).toBeUndefined();
  expect(files['apps/server/package.json']).toBeUndefined();
  expect(JSON.stringify(files['package.json'])).not.toContain('@orpc/server');
  expect(files['src/components/providers.tsx']).toContain('ClerkProvider');
  expect(files['eslint.config.mjs']).toBeDefined();
  expect(files['src/components/ui/button.tsx']).toBeDefined();
  expect(files['packages/ui/src/button.tsx']).toBeUndefined();
  expect(files['src/routes/notes.tsx']).toContain('from "convex/react"');
  expect(files['src/routes/notes.tsx']).toContain('useQuery');
});
test('Convex plus postgres still errors', () => {
  expect(() =>
    resolveStack({ backend: 'convex', database: 'postgres' })
  ).toThrow('convex-database-off');
});
