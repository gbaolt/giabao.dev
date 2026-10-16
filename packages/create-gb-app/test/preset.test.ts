import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import {
  decodePreset,
  encodePreset,
  GOLDEN_PRESETS,
  rawFlagsFromPreset,
} from '#/preset';
import { resolveStack, YES_DEFAULTS } from '#/stack/resolve';
import type { PresetFields } from '#/types/stack';
test('encodePreset writes compact defaults and reads versioned defaults', () => {
  expect(encodePreset(YES_DEFAULTS)).toBe('gb-v2-0');
  expect(decodePreset('gb-v1-0')).toEqual({
    ...YES_DEFAULTS,
    addons: {
      toolchain: 'standard',
      taskRunner: 'none',
      linting: 'eslint',
      form: 'none',
    },
  });
  expect(decodePreset('gb-v2-0')).toEqual(YES_DEFAULTS);
});
test('encodePreset and decodePreset round-trip a non-default overlay', () => {
  const fields: PresetFields = {
    ...YES_DEFAULTS,
    frontend: 'tanstack-start',
    addons: {
      ...YES_DEFAULTS.addons,
      linting: 'oxlint',
    },
  };
  const code = encodePreset(fields);
  expect(code).toStartWith('gb');
  expect(code).not.toStartWith('gb-v1-');
  expect(decodePreset(code)).toEqual(fields);
});
test('literal legacy codes retain their original selections', () => {
  expect(decodePreset('gb8wy')).toEqual(GOLDEN_PRESETS.nest);
  expect(decodePreset('gbh3b')).toEqual(GOLDEN_PRESETS.start);
  expect(decodePreset('gb60')).toEqual(GOLDEN_PRESETS.convex);
  expect(decodePreset('gb2')).toEqual({
    ...YES_DEFAULTS,
    backend: 'nest',
    structure: 'monorepo',
    addons: {
      ...YES_DEFAULTS.addons,
      taskRunner: 'turborepo',
      linting: 'eslint',
    },
  });
  expect(decodePreset('gb6')).toEqual({
    ...YES_DEFAULTS,
    backend: 'hono',
    structure: 'monorepo',
    addons: {
      ...YES_DEFAULTS.addons,
      taskRunner: 'turborepo',
      linting: 'eslint',
    },
  });
  expect(decodePreset('gb-v1-48')).toEqual(decodePreset('gb2'));
});
test('compact codes preserve named preset selections', () => {
  for (const fields of Object.values(GOLDEN_PRESETS)) {
    expect(decodePreset(encodePreset(fields))).toEqual(fields);
  }
});
test('malformed, unsupported, or future-slot codes fail closed', () => {
  expect(() => decodePreset('g111')).toThrow('invalid preset');
  expect(() => decodePreset('gc0')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v3-0')).toThrow('unsupported preset version');
  expect(() => decodePreset('gb-v1-')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v1-00')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v1-!')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v1-47')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v1-oXcFcXavRgn2p68')).toThrow('invalid preset');
  expect(() => decodePreset('gb-v1-1F2si9ujpxVB7VDj2')).toThrow(
    'invalid preset'
  );
});
test('golden nest builds a FileMap', () => {
  const files = buildTree(
    resolveStack(rawFlagsFromPreset(GOLDEN_PRESETS.nest)),
    {
      projectName: 'nest-app',
      packageManager: 'pnpm',
    }
  );
  expect(files['turbo.json']).toBeDefined();
  expect(files['README.md']).toContain('nest-app');
});
test('golden start builds a FileMap', () => {
  const files = buildTree(
    resolveStack(rawFlagsFromPreset(GOLDEN_PRESETS.start)),
    {
      projectName: 'start-app',
      packageManager: 'bun',
    }
  );
  expect(files['vite.config.ts']).toBeDefined();
});
test('golden convex builds a FileMap', () => {
  const files = buildTree(
    resolveStack(rawFlagsFromPreset(GOLDEN_PRESETS.convex)),
    {
      projectName: 'convex-app',
      packageManager: 'bun',
    }
  );
  expect(files['convex/schema.ts']).toBeDefined();
});
test('nest plus default eslint builds a FileMap', () => {
  const files = buildTree(resolveStack({ backend: 'nest' }), {
    projectName: 'nest-app',
    packageManager: 'npm',
  });
  expect(files['eslint.config.mjs']).toBeDefined();
  expect(files['apps/server/package.json']).toContain('@nestjs/core');
});
test('database none is an app shell', () => {
  const files = buildTree(
    resolveStack({
      database: 'none',
      orm: 'none',
      dbSetup: 'none',
      auth: 'none',
      api: 'none',
    }),
    { projectName: 'shell-app', packageManager: 'bun' }
  );
  expect(files['package.json']).toContain('"name": "shell-app"');
  expect(files['components/ui/button.tsx']).toBeDefined();
  expect(files['app/providers.tsx']).toContain('export function Providers');
  expect(files['app/layout.tsx']).toContain("from './providers'");
  expect(files['app/notes/page.tsx']).toBeUndefined();
  expect(files['prisma/schema.prisma']).toBeUndefined();
  expect(files['router.ts']).toBeUndefined();
});
test('api none still emits notes without an RPC router', () => {
  const files = buildTree(resolveStack({ api: 'none' }), {
    projectName: 'actions-app',
    packageManager: 'bun',
  });
  expect(files['app/notes/actions.ts']).toContain('"use server"');
  expect(files['app/notes/page.tsx']).toBeDefined();
  expect(files['router.ts']).toBeUndefined();
  expect(files['app/rpc/[[...rest]]/route.ts']).toBeUndefined();
  expect(files['prisma/schema.prisma']).toContain('model Note');
});
test('api none on Start uses createServerFn', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      api: 'none',
      auth: 'none',
      addons: {
        linting: 'oxlint',
      },
    }),
    { projectName: 'start-actions', packageManager: 'bun' }
  );
  expect(files['src/server/notes.ts']).toContain('createServerFn');
  expect(files['src/server/router.ts']).toBeUndefined();
  expect(files['packages/contract/package.json']).toBeUndefined();
});
test('minimal Start shell resolves its provider and Vite types', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      database: 'none',
      auth: 'none',
      api: 'none',
    }),
    { projectName: 'start-shell', packageManager: 'bun' }
  );
  expect(files['src/components/providers.tsx']).toContain(
    'export function Providers'
  );
  expect(files['src/routes/__root.tsx']).toContain(
    'from "../components/providers"'
  );
  expect(files['src/router.tsx']).toContain('routeTree.gen');
  expect(files['tsconfig.json']).toContain('vite/client');
});
test('api none on Nest is REST without a contract package', () => {
  const files = buildTree(
    resolveStack({
      backend: 'nest',
      api: 'none',
      addons: {
        linting: 'biome',
      },
    }),
    { projectName: 'nest-rest', packageManager: 'pnpm' }
  );
  expect(files['apps/server/src/notes.controller.ts']).toContain('@Get()');
  expect(files['packages/contract/src/contract.ts']).toBeUndefined();
  expect(files['apps/server/prisma/schema.prisma']).toBeDefined();
  expect(files['apps/web/prisma/schema.prisma']).toBeUndefined();
  expect(JSON.stringify(files['apps/web/package.json'])).not.toContain(
    'prisma'
  );
});
