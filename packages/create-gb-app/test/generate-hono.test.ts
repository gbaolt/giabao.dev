import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { decodePreset, encodePreset } from '#/preset';
import { resolveStack, YES_DEFAULTS } from '#/stack/resolve';

const ctx = { projectName: 'hono-app', packageManager: 'pnpm' } as const;

test('hono next FileMap includes apps/server and @hono/node-server', () => {
  const files = buildTree(resolveStack({ backend: 'hono' }), ctx);
  expect(files['apps/server/package.json']).toContain('@hono/node-server');
  expect(files['apps/server/src/index.ts']).toContain(
    'from "@hono/node-server"'
  );
  expect(files['apps/server/src/index.ts']).toContain('serve(');
  expect(files['apps/server/src/main.ts']).toBeUndefined();
  expect(files['apps/web/package.json']).toContain('"next"');
  expect(files['packages/contract/src/index.ts']).toContain('openapi(');
  expect(files['README.md']).toContain(
    'https://hono.dev/docs/getting-started/nodejs'
  );
  expect(files['README.md']).toContain('Hono Node');
  expect(files['app/api/[[...route]]/route.ts']).toBeUndefined();
  expect(files['apps/web/app/api/[[...route]]/route.ts']).toBeUndefined();
  expect(files['vite.config.ts']).toBeUndefined();
  expect(encodePreset(YES_DEFAULTS)).toBe('gb-v2-0');
  expect(decodePreset('gb-v2-0')).toEqual(YES_DEFAULTS);
});

test('hono start FileMap includes apps/server under the turbo root', () => {
  const files = buildTree(
    resolveStack({ backend: 'hono', frontend: 'tanstack-start', addons: { taskRunner: 'turborepo' } }),
    ctx
  );
  expect(files['apps/server/package.json']).toContain('@hono/node-server');
  expect(files['apps/server/src/index.ts']).toContain('serve(');
  expect(files['apps/web/vite.config.ts']).toContain('tanstackStart');
  expect(files['apps/web/src/routes/__root.tsx']).toContain('Providers');
  expect(files['apps/web/src/components/providers.tsx']).toBeDefined();
  expect(files['package.json']).toContain('"dev": "turbo run dev"');
  expect(files['package.json']).not.toContain('vite dev');
  expect(files['vite.config.ts']).toBeUndefined();
  expect(files['src/routes/__root.tsx']).toBeUndefined();
});

test('hono api none omits packages/contract and keeps REST notes', () => {
  const files = buildTree(resolveStack({ backend: 'hono', api: 'none' }), ctx);
  expect(
    Object.keys(files).some((path) => path.startsWith('packages/contract/'))
  ).toBe(false);
  expect(files['apps/server/src/index.ts']).toContain('"/notes"');
  expect(files['apps/server/src/notes.ts']).toContain('prisma.note');
  expect(files['apps/server/package.json']).toContain('@hono/node-server');
});

test('hono trpc emits a contract and mounts @hono/trpc-server', () => {
  const files = buildTree(resolveStack({ backend: 'hono', api: 'trpc' }), ctx);
  expect(files['packages/contract/src/index.ts']).toContain('appRouter');
  expect(files['apps/server/package.json']).toContain('@hono/trpc-server');
  expect(files['apps/server/src/index.ts']).toContain('trpcServer');
});

test('npm workspaces use star protocol for the hono contract', () => {
  const files = buildTree(resolveStack({ backend: 'hono' }), {
    projectName: 'hono-npm',
    packageManager: 'npm',
  });
  expect(files['apps/server/package.json']).toContain('"@repo/contract": "*"');
  expect(files['apps/server/src/index.ts']).toContain(
    'from "@hono/node-server"'
  );
});

test('bun uses the same server entry as pnpm', () => {
  const pnpm = buildTree(resolveStack({ backend: 'hono' }), ctx);
  const bun = buildTree(resolveStack({ backend: 'hono' }), {
    projectName: 'hono-app',
    packageManager: 'bun',
  });
  expect(bun['apps/server/src/index.ts']).toBe(
    pnpm['apps/server/src/index.ts']
  );
});
