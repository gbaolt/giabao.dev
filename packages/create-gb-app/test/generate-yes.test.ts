import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import {
  buildTree as publicBuildTree,
  resolveStack as publicResolveStack,
} from 'create-gb-app/generate';

import { inferPackageManager } from '#/cli/package-manager';
import { buildTree } from '#/generate/build-tree';
import { writeTree } from '#/generate/write-tree';
import { resolveStack } from '#/stack/resolve';

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
  'components/login-form.tsx',
  'components/theme-provider.tsx',
  'components/ui/button.tsx',
  'components/ui/card.tsx',
  'components/ui/checkbox.tsx',
  'components/ui/field.tsx',
  'components/ui/input.tsx',
  'components/ui/label.tsx',
  'components/ui/select.tsx',
  'components/ui/separator.tsx',
  'components/ui/textarea.tsx',
  'eslint.config.mjs',
  'global.d.ts',
  'lib/auth-client.ts',
  'lib/auth.ts',
  'lib/db.ts',
  'lib/note-validation.ts',
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

test('buildTree --yes emits literal paths and package names', () => {
  const stack = resolveStack({ yes: true });
  const files = buildTree(stack, {
    projectName: 'yes-app',
    packageManager: 'bun',
  });

  expect(Object.keys(files).sort()).toEqual(YES_PATHS);
  expect(files['turbo.json']).toBeUndefined();

  const pkg = JSON.parse(files['package.json']) as {
    dependencies: Record<string, string>;
    name: string;
  };
  expect(pkg.name).toBe('yes-app');
  expect(pkg.dependencies.next).toBe('^15.5.4');
  expect(pkg.dependencies['better-auth']).toBe('~1.6.11');
  expect(pkg.dependencies['@orpc/server']).toBe('2.0.0-beta.43');
  expect(pkg.dependencies['@orpc/client']).toBe('2.0.0-beta.43');
  expect(pkg.dependencies['@orpc/tanstack-query']).toBe('2.0.0-beta.43');
  expect(pkg.dependencies['@prisma/client']).toBe('^6.16.1');
  expect(pkg.dependencies['@tanstack/react-query']).toBe('^5.89.0');
  expect(JSON.stringify(pkg)).not.toContain('workspace:');

  expect(files['prisma/schema.prisma']).toContain('model Note');
  expect(files['app/api/auth/[...all]/route.ts']).toContain('toNextJsHandler');
  expect(files['app/api/auth/[...all]/route.ts']).not.toContain(
    'tanstackStartCookies'
  );
  expect(files['app/notes/notes-client.tsx']).toContain(
    'orpc.notes.list.queryOptions'
  );
  expect(files['.env']).toContain('postgres://');
  expect(files['.env']).toContain('localhost');
  expect(files['README.md']).toContain('## Features');
  expect(files['README.md']).toContain('## Getting started');
  expect(files['README.md']).toContain('bun install');
  expect(files['README.md']).toContain('## Available scripts');
  expect(files['README.md']).not.toContain('Project structure');
});

test('writeTree --yes --no-git dest has package.json and no turbo.json', async () => {
  const dest = await mkdtemp(join(tmpdir(), 'cga-yes-'));
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest);
  const stack = resolveStack({ yes: true });
  const files = buildTree(stack, {
    projectName: 'yes-app',
    packageManager: inferPackageManager('npm/10.0.0 node/22.0.0'),
  });
  await writeTree(dest, files);
  const listing = await readdir(dest);
  expect(listing).toContain('package.json');
  expect(listing).not.toContain('turbo.json');
  expect(listing).not.toContain('.git');
  const login = await readFile(join(dest, 'components/login-form.tsx'), 'utf8');
  expect(login).toContain('return (\n    <Card>');
  await rm(dest, { recursive: true, force: true });
});

test('public generate import emits the same --yes paths', () => {
  const files = publicBuildTree(publicResolveStack({ yes: true }), {
    projectName: 'yes-app',
    packageManager: 'bun',
  });
  expect(Object.keys(files).sort()).toEqual(YES_PATHS);
});
