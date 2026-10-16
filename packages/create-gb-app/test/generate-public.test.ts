import { expect, test } from 'bun:test';

import type { RawFlags } from '#/generate/public';
import * as generate from '#/generate/public';
import { buildTree, resolveStack, YES_DEFAULTS } from '#/generate/public';
const YES_PATHS = [
  '.env',
  '.env.example',
  '.gitignore',
  'README.md',
  'app/api/auth/[...all]/route.ts',
  'app/globals.css',
  'app/layout.tsx',
  'app/login/page.tsx',
  'app/notes/notes-client.tsx',
  'app/notes/page.tsx',
  'app/page.tsx',
  'app/providers.tsx',
  'app/rpc/[[...rest]]/route.ts',
  'components.json',
  'components/ui/button.tsx',
  'components/ui/card.tsx',
  'components/ui/input.tsx',
  'eslint.config.mjs',
  'lib/auth-client.ts',
  'lib/auth.ts',
  'lib/db.ts',
  'lib/orpc.ts',
  'lib/query-client.ts',
  'lib/utils.ts',
  'next-env.d.ts',
  'next.config.ts',
  'package.json',
  'postcss.config.mjs',
  'prisma/schema.prisma',
  'router.ts',
  'tsconfig.json',
];
test('public generate still emits YES paths', () => {
  const flags: RawFlags = { yes: true };
  const files = buildTree(resolveStack(flags), {
    projectName: 'yes-app',
    packageManager: 'bun',
  });
  for (const path of YES_PATHS) {
    expect(files[path]).toBeDefined();
  }
  expect(files['lib/note-validation.ts']).toBeDefined();
  expect(YES_DEFAULTS.frontend).toBe('next');
  expect(YES_DEFAULTS.backend).toBe('self');
});
test('public generate exports stack and tree entry points', () => {
  expect(generate.encodePreset(YES_DEFAULTS)).toBe('gb-v2-0');
  expect(generate.decodePreset('gb-v2-0')).toEqual(YES_DEFAULTS);
  expect(typeof generate.CompatError).toBe('function');
  expect(typeof generate.GenerateError).toBe('function');
});
test('literal legacy preset generates its historical layout', () => {
  const files = buildTree(resolveStack(generate.decodePreset('gb2')), {
    projectName: 'saved-nest',
    packageManager: 'pnpm',
  });
  expect(files['turbo.json']).toBeDefined();
  expect(files['apps/server/package.json']).toContain('@nestjs/core');
});
test('resolved structure owns the generated app and server paths', () => {
  const single = buildTree(
    resolveStack({ database: 'none', auth: 'none', api: 'none' }),
    { projectName: 'single', packageManager: 'bun' }
  );
  expect(single['app/layout.tsx']).toBeDefined();
  expect(single['apps/web/package.json']).toBeUndefined();
  expect(single['turbo.json']).toBeUndefined();
  for (const backend of ['nest', 'hono'] as const) {
    const workspace = buildTree(resolveStack({ backend }), {
      projectName: `workspace-${backend}`,
      packageManager: 'pnpm',
    });
    expect(workspace['turbo.json']).toBeUndefined();
    expect(workspace['apps/web/package.json']).toBeDefined();
    expect(workspace['apps/server/package.json']).toBeDefined();
    expect(workspace['packages/ui/package.json']).toBeDefined();
    expect(workspace['app/layout.tsx']).toBeUndefined();
    const rootManifest = JSON.parse(workspace['package.json']);
    expect(rootManifest.workspaces).toContain('apps/*');
    expect(rootManifest.workspaces).toContain('packages/*');
  }
  const convex = buildTree(resolveStack({ backend: 'convex' }), {
    projectName: 'convex-single',
    packageManager: 'bun',
  });
  expect(convex['convex/schema.ts']).toBeDefined();
  expect(convex['apps/server/package.json']).toBeUndefined();
  expect(convex['turbo.json']).toBeUndefined();
});
test('public generate does not export CLI or goldens', () => {
  expect('GOLDEN_PRESETS' in generate).toBe(false);
  expect('writeTree' in generate).toBe(false);
  expect('generateApp' in generate).toBe(false);
  expect('parseArgs' in generate).toBe(false);
  expect('ParseError' in generate).toBe(true);
});
