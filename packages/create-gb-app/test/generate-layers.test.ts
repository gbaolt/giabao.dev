import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { writeTree } from '#/generate/write-tree';
import { CompatError } from '#/stack/errors';
import { resolveStack } from '#/stack/resolve';
test('drizzle on Self writes drizzle schema not prisma', () => {
  const files = buildTree(resolveStack({ orm: 'drizzle', auth: 'none' }), {
    projectName: 'drizzle-app',
    packageManager: 'bun',
  });
  expect(files['lib/schema.ts']).toBeDefined();
  expect(files['drizzle.config.ts']).toBeDefined();
  expect(files['prisma/schema.prisma']).toBeUndefined();
});
test('sqlite without docker uses file URL', () => {
  const files = buildTree(resolveStack({ database: 'sqlite', auth: 'none' }), {
    projectName: 'sqlite-app',
    packageManager: 'bun',
  });
  expect(files['.env']).toContain('file:');
  expect(files['docker-compose.yml']).toBeUndefined();
});
test('docker postgres writes compose YAML', () => {
  const files = buildTree(
    resolveStack({ dbSetup: 'docker', database: 'postgres', auth: 'none' }),
    { projectName: 'docker-app', packageManager: 'bun' }
  );
  expect(files['docker-compose.yml']).toContain('postgres');
});
test('neon env on postgres', () => {
  const files = buildTree(
    resolveStack({ dbSetup: 'neon', database: 'postgres', auth: 'none' }),
    { projectName: 'neon-app', packageManager: 'bun' }
  );
  expect(files['.env']).toContain('neon.tech');
  expect(files['docker-compose.yml']).toBeUndefined();
});
test('Clerk plus Next plus tRPC provider order', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'next',
      api: 'trpc',
      auth: 'clerk',
    }),
    { projectName: 'clerk-trpc', packageManager: 'bun' }
  );
  expect(files['app/providers.tsx']).toContain('ClerkProvider');
  expect(files['app/providers.tsx']).toContain('trpc.Provider');
  expect(files['middleware.ts']).toContain('trpc');
});
test('Stripe plus Clerk writes webhook and portal', () => {
  const files = buildTree(resolveStack({ auth: 'clerk', payments: 'stripe' }), {
    projectName: 'stripe-app',
    packageManager: 'bun',
  });
  expect(files['app/api/stripe/webhook/route.ts']).toBeDefined();
  expect(files['app/portal/page.tsx']).toBeDefined();
});
test('Polar plus Better Auth writes plugin', () => {
  const files = buildTree(
    resolveStack({ auth: 'better-auth', payments: 'polar' }),
    { projectName: 'polar-app', packageManager: 'bun' }
  );
  expect(files['package.json']).toContain('@polar-sh/better-auth');
  expect(files['lib/auth.ts']).toContain('polar(');
  expect(files['lib/auth.ts']).toContain('pro');
  expect(files['lib/auth.ts'].indexOf('polar(')).toBeLessThan(
    files['lib/auth.ts'].indexOf('nextCookies()')
  );
});
test('Polar plus Clerk still errors and dest stays empty', async () => {
  expect(() => resolveStack({ auth: 'clerk', payments: 'polar' })).toThrow(
    CompatError
  );
  const dest = await mkdtemp(join(tmpdir(), 'cga-empty-'));
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest);
  const listing = await readdir(dest);
  expect(listing).toEqual([]);
  await rm(dest, { recursive: true, force: true });
});
test('supabase env on postgres', () => {
  const files = buildTree(
    resolveStack({ dbSetup: 'supabase', database: 'postgres', auth: 'none' }),
    { projectName: 'supabase-app', packageManager: 'bun' }
  );
  expect(files['.env']).toContain('supabase.co');
  expect(files['docker-compose.yml']).toBeUndefined();
});
test('Clerk on Nest writes @clerk/express', () => {
  const files = buildTree(
    resolveStack({
      backend: 'nest',
      auth: 'clerk',
      addons: {
        linting: 'biome',
      },
    }),
    { projectName: 'nest-clerk', packageManager: 'pnpm' }
  );
  expect(files['apps/server/package.json']).toContain('@clerk/express');
  expect(files['apps/server/src/notes.controller.ts']).toContain('getAuth');
  expect(files['apps/server/package.json']).not.toContain('better-auth');
  expect(files['apps/server/src/main.ts']).toContain('clerkMiddleware');
  expect(files['apps/server/src/app.module.ts']).not.toContain('AuthModule');
});
test('Better Auth on Convex writes @convex-dev/better-auth', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      backend: 'convex',
      auth: 'better-auth',
      addons: {
        linting: 'oxlint',
      },
    }),
    { projectName: 'convex-ba', packageManager: 'bun' }
  );
  expect(files['package.json']).toContain('@convex-dev/better-auth');
  expect(files['convex/betterAuth.ts']).toContain('convex()');
});
test('Better Auth plugin last on Start', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      api: 'trpc',
      auth: 'better-auth',
      addons: {
        linting: 'oxlint',
      },
    }),
    { projectName: 'start-auth', packageManager: 'bun' }
  );
  const auth = files['src/lib/auth.ts'];
  expect(auth).toContain('tanstackStartCookies()');
  const pluginsIdx = auth.indexOf('plugins: [');
  const closeIdx = auth.lastIndexOf(']');
  expect(
    auth.slice(pluginsIdx, closeIdx + 1).endsWith('tanstackStartCookies()]')
  ).toBe(true);
});
