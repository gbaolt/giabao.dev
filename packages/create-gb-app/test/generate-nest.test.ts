import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { GenerateError } from '#/generate/errors';
import { previewTree } from '#/preview/tree';
import { resolveStack } from '#/stack/resolve';
const NEST_FLAGS = {
  backend: 'nest',
  addons: {
    linting: 'biome',
  },
} as const;
test('buildTree Nest golden emits contract-first monorepo', () => {
  const started = performance.now();
  const stack = resolveStack(NEST_FLAGS);
  const files = buildTree(stack, {
    projectName: 'nest-app',
    packageManager: 'pnpm',
  });
  const ms = performance.now() - started;
  console.log(`buildTree nest ${ms.toFixed(2)}ms`);
  expect(ms).toBeLessThan(4000);
  expect(files['turbo.json']).toBeUndefined();
  expect(files['biome.json']).toContain('unsafeParameterDecoratorsEnabled');
  expect(files['apps/web/package.json']).toContain('@repo/contract');
  expect(files['apps/web/package.json']).toContain('workspace:*');
  expect(files['apps/web/package.json']).toContain('better-auth');
  expect(files['apps/server/package.json']).toContain('better-auth');
  expect(files['apps/server/src/main.ts']).toContain('bodyParser: false');
  expect(files['apps/server/src/app.module.ts']).toContain(
    'AuthModule.forRoot'
  );
  expect(files['apps/server/src/app.module.ts']).toContain('json:');
  expect(files['apps/server/src/main.ts']).toContain('credentials: true');
  expect(files['apps/web/lib/orpc-link.ts']).toContain('OpenAPILink');
  expect(files['apps/web/lib/orpc-link.ts']).toContain(
    'credentials: "include"'
  );
  expect(files['apps/web/app/notes/notes-client.tsx']).toContain('@repo/ui');
  expect(files['apps/web/app/notes/notes-client.tsx']).not.toContain(
    '@/components/ui'
  );
  expect(files['apps/server/src/notes.controller.ts']).toContain(
    'fromNodeHeaders'
  );
  const contract = Object.entries(files)
    .filter(([path]) => path.startsWith('packages/contract/'))
    .map(([, content]) => content)
    .join('\n');
  expect(contract).toContain('openapi(');
  expect(contract).not.toContain('.handler');
  expect(Object.keys(files).some((path) => path.includes('toWebHeaders'))).toBe(
    false
  );
  expect(files['packages/eslint-config/package.json']).toBeUndefined();
});
test('npm workspaces use star protocol', () => {
  const files = buildTree(resolveStack(NEST_FLAGS), {
    projectName: 'nest-npm',
    packageManager: 'npm',
  });
  expect(files['apps/web/package.json']).toContain('"@repo/contract": "*"');
  expect(files['apps/web/package.json']).not.toContain('workspace:');
});
test('nest plus start returns a FileMap with a Nest server and Start web', () => {
  const stack = resolveStack({ ...NEST_FLAGS, frontend: 'tanstack-start', addons: { ...NEST_FLAGS.addons, taskRunner: 'turborepo' } });
  const files = buildTree(stack, {
    projectName: 'nest-start',
    packageManager: 'pnpm',
  });
  expect(files['apps/server/package.json']).toContain('@nestjs/core');
  expect(files['apps/server/src/main.ts']).toContain('NestFactory');
  expect(files['apps/web/vite.config.ts']).toContain('tanstackStart');
  expect(files['apps/web/src/routes/__root.tsx']).toContain('Providers');
  expect(files['apps/web/src/components/providers.tsx']).toContain(
    'QueryClientProvider'
  );
  expect(files['apps/web/src/routes/notes.tsx']).toContain('@repo/ui');
  expect(files['apps/web/src/lib/orpc-link.ts']).toContain('OpenAPILink');
  expect(files['packages/contract/package.json']).toBeDefined();
  expect(files['apps/web/app/page.tsx']).toBeUndefined();
  expect(files['vite.config.ts']).toBeUndefined();
  expect(files['src/routes/__root.tsx']).toBeUndefined();
  expect(files['package.json']).toContain('"dev": "turbo run dev"');
  expect(files['package.json']).not.toContain('vite dev');
  expect(files['turbo.json']).toContain('.output/**');
  expect(files['turbo.json']).toContain('.vinxi/**');
  expect(files['.gitignore']).toContain('.output');
  expect(files['apps/web/.env']).toContain('VITE_SERVER_URL="http://localhost:3333"');
  expect(previewTree(stack)).toContain('apps/web');
  expect(previewTree(stack)).toContain('apps/server');
  expect(previewTree(stack).split('\n')[0]).toBe('apps/web');
});
test('nest plus start with api none keeps REST and omits the contract', () => {
  const files = buildTree(
    resolveStack({ ...NEST_FLAGS, frontend: 'tanstack-start', api: 'none' }),
    { projectName: 'nest-start', packageManager: 'pnpm' }
  );
  expect(
    Object.keys(files).some((path) => path.startsWith('packages/contract/'))
  ).toBe(false);
  expect(files['apps/server/src/notes.controller.ts']).toContain(
    '@Controller("notes")'
  );
  expect(files['apps/web/src/routes/notes.tsx']).toContain('"/notes"');
  expect(files['apps/web/vite.config.ts']).toBeDefined();
  expect(files['apps/server/package.json']).toContain('@nestjs/core');
});
test('nest plus start with trpc stays a gap', () => {
  try {
    buildTree(
      resolveStack({ ...NEST_FLAGS, frontend: 'tanstack-start', api: 'trpc' }),
      { projectName: 'nest-start', packageManager: 'pnpm' }
    );
    throw new Error('expected GenerateError');
  } catch (error) {
    expect(error).toBeInstanceOf(GenerateError);
    expect((error as GenerateError).code).toBe('nest-trpc');
    expect((error as GenerateError).message).toBe(
      'nest trpc generate is not implemented yet'
    );
  }
});
test('nest plus eslint and oxlint return a FileMap', () => {
  const eslintFiles = buildTree(resolveStack({ backend: 'nest' }), {
    projectName: 'nest-app',
    packageManager: 'npm',
  });
  expect(eslintFiles['eslint.config.mjs']).toContain('next/core-web-vitals');
  expect(eslintFiles['apps/server/package.json']).toContain('@nestjs/core');
  const oxlintFiles = buildTree(
    resolveStack({
      backend: 'nest',
      addons: {
        linting: 'oxlint',
      },
    }),
    { projectName: 'nest-app', packageManager: 'npm' }
  );
  expect(oxlintFiles['.oxlintrc.json']).toContain('typescript');
  expect(oxlintFiles['apps/server/src/main.ts']).toContain('NestFactory');
});
