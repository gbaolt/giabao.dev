import { expect, test } from 'bun:test';
import { YES_DEFAULTS } from 'create-gb-app/preset';

import { normalizeFlags } from '../compat';
import {
  buildCreateFileMap,
  flagsToRaw,
  isCreateFlags,
} from '../generate-files';

test('isCreateFlags rejects incomplete payloads', () => {
  expect(isCreateFlags(YES_DEFAULTS)).toBe(true);
  expect(isCreateFlags({ frontend: 'next' })).toBe(false);
  expect(isCreateFlags(null)).toBe(false);
});

test('public Start oRPC preview agrees with its native generated application', () => {
  const result = buildCreateFileMap(
    {
      ...YES_DEFAULTS,
      frontend: 'tanstack-start',
      auth: 'none',
      linter: 'oxlint',
    },
    'start-orpc'
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.files['src/routes/api/rpc.$.ts']).toBeDefined();
  expect(result.files['src/routes/notes.tsx']).toContain('Delete');
  expect(result.files['app/notes/page.tsx']).toBeUndefined();
});

test('unverified Start oRPC combinations return the generation gap in preview', () => {
  const result = buildCreateFileMap(
    { ...YES_DEFAULTS, frontend: 'tanstack-start', database: 'mysql' },
    'unsupported'
  );
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe('start-orpc');
  expect(result.message).toContain('PostgreSQL');
});

test('convex preview keeps relational none and is not convex-database-off', () => {
  const flags = normalizeFlags({ ...YES_DEFAULTS, backend: 'convex' });
  expect(flagsToRaw(flags)).toEqual({
    frontend: 'next',
    backend: 'convex',
    structure: 'single',
    api: 'none',
    database: 'none',
    orm: 'none',
    dbSetup: 'none',
    auth: 'better-auth',
    payments: 'none',
    linter: 'eslint',
    form: 'none',
  });
  const result = buildCreateFileMap(flags, 'convex-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['convex/schema.ts']).toBeDefined();
  expect(
    result.files['components/ui/button.tsx'] ??
      result.files['src/components/ui/button.tsx']
  ).toBeDefined();
});

test.each([
  ['next', 'react-hook-form', 'components/notes-form.tsx', 'react-hook-form'],
  [
    'tanstack-start',
    'tanstack-form',
    'src/components/notes-form.tsx',
    '@tanstack/react-form',
  ],
] as const)(
  '%s preview includes the selected %s templates',
  (frontend, form, notesPath, dependency) => {
    const flags = normalizeFlags({
      ...YES_DEFAULTS,
      frontend,
      form,
      api: frontend === 'tanstack-start' ? 'none' : YES_DEFAULTS.api,
    });
    const result = buildCreateFileMap(flags, 'forms-app');
    if (!result.ok) throw new Error(result.message);
    expect(result.ok).toBe(true);

    expect(result.files[notesPath]).toBeDefined();
    expect(
      result.files[notesPath.replace('notes-form.tsx', 'form/form-base.tsx')]
    ).toBeDefined();
    expect(
      result.files[notesPath.replace('notes-form.tsx', 'form/README.md')]
    ).toBeDefined();
    expect(result.files['package.json']).toContain(dependency);
  }
);

test('database none is a shell without notes', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    database: 'none',
    api: 'none',
  });
  const result = buildCreateFileMap(flags, 'shell-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['package.json']).toContain('"name": "shell-app"');
  expect(result.files['components/ui/button.tsx']).toBeDefined();
  expect(result.files['app/notes/page.tsx']).toBeUndefined();
  expect(result.files['prisma/schema.prisma']).toBeUndefined();
});

test('api none emits notes without an RPC router', () => {
  const flags = normalizeFlags({ ...YES_DEFAULTS, api: 'none' });
  const result = buildCreateFileMap(flags, 'actions-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['app/notes/actions.ts']).toContain('"use server"');
  expect(result.files['router.ts']).toBeUndefined();
});

test('default generate includes package.json', () => {
  const result = buildCreateFileMap(YES_DEFAULTS, 'my-gb-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['package.json']).toContain('"name": "my-gb-app"');
  expect(Object.keys(result.files)).toContain('.gitignore');
  expect(Object.keys(result.files)).toContain('README.md');
  expect(result.files['app/layout.tsx']).toBeDefined();
  expect(result.files['apps/web/package.json']).toBeUndefined();
});

test('hono next preview lists apps/server and @hono/node-server', () => {
  const flags = normalizeFlags({ ...YES_DEFAULTS, backend: 'hono' });
  const result = buildCreateFileMap(flags, 'hono-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['apps/server/package.json']).toContain(
    '@hono/node-server'
  );
  expect(result.files['apps/web/package.json']).toBeDefined();
  expect(result.files['README.md']).toContain(
    'https://hono.dev/docs/getting-started/nodejs'
  );
});

test('hono start preview lists apps/server', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    backend: 'hono',
    frontend: 'tanstack-start',
  });
  const result = buildCreateFileMap(flags, 'hono-start');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['apps/server/package.json']).toContain(
    '@hono/node-server'
  );
  expect(result.files['apps/web/vite.config.ts']).toBeDefined();
  expect(result.files['vite.config.ts']).toBeUndefined();
});

test('hono api none preview has no packages/contract', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    backend: 'hono',
    api: 'none',
  });
  const result = buildCreateFileMap(flags, 'hono-rest');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(
    Object.keys(result.files).some((path) =>
      path.startsWith('packages/contract/')
    )
  ).toBe(false);
  expect(result.files['apps/server/src/index.ts']).toContain('"/notes"');
});

test('nest plus start returns a FileMap', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    backend: 'nest',
    frontend: 'tanstack-start',
  });
  const result = buildCreateFileMap(flags, 'nest-start');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['apps/server/package.json']).toContain('@nestjs/core');
  expect(result.files['apps/web/vite.config.ts']).toContain('tanstackStart');
  expect(result.files['apps/web/src/routes/__root.tsx']).toBeDefined();
  expect(result.files['apps/web/src/components/providers.tsx']).toBeDefined();
  expect(result.files['package.json']).toContain('"dev": "turbo run dev"');
  expect(result.files['vite.config.ts']).toBeUndefined();
  expect(result.files['src/routes/__root.tsx']).toBeUndefined();
  expect(result.files['packages/contract/package.json']).toBeDefined();
});

test('nest plus start with api none omits the contract', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    backend: 'nest',
    frontend: 'tanstack-start',
    api: 'none',
  });
  const result = buildCreateFileMap(flags, 'nest-start-rest');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(
    Object.keys(result.files).some((path) =>
      path.startsWith('packages/contract/')
    )
  ).toBe(false);
  expect(result.files['apps/server/src/notes.controller.ts']).toContain(
    '@Controller("notes")'
  );
  expect(result.files['apps/web/src/routes/notes.tsx']).toBeDefined();
});

test('nest plus start with trpc stays disabled', () => {
  const flags = normalizeFlags({
    ...YES_DEFAULTS,
    backend: 'nest',
    frontend: 'tanstack-start',
    api: 'trpc',
  });
  expect(flags.api).not.toBe('trpc');
  const result = buildCreateFileMap(
    {
      ...YES_DEFAULTS,
      backend: 'nest',
      structure: 'turborepo',
      frontend: 'tanstack-start',
      api: 'trpc',
      linter: 'biome',
    },
    'nest-start-trpc'
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.code).toBe('nest-trpc');
});

test('nest plus eslint returns a FileMap', () => {
  const result = buildCreateFileMap(
    normalizeFlags({ ...YES_DEFAULTS, backend: 'nest' }),
    'nest-app'
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.files['eslint.config.mjs']).toBeDefined();
  expect(result.files['apps/server/package.json']).toContain('@nestjs/core');
});
