import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';

test('fresh separate backends use plain monorepos without Turbo artifacts', () => {
  for (const backend of ['nest', 'hono'] as const) {
    const stack = resolveStack({
      backend,
      database: 'none',
      auth: 'none',
      api: 'none',
    });
    expect(stack.structure).toBe('monorepo');
    expect(stack.addons.taskRunner).toBe('none');
    const files = buildTree(stack, {
      projectName: 'plain-app',
      packageManager: 'bun',
    });
    expect(files['turbo.json']).toBeUndefined();
    expect(files['.gitignore']).not.toContain('.turbo');
    const root = JSON.parse(files['package.json']);
    expect(root.devDependencies.turbo).toBeUndefined();
    for (const task of ['dev', 'build', 'start', 'lint', 'typecheck']) {
      expect(root.scripts[task]).toContain('node ');
    }
    expect(files['apps/web/package.json']).toBeDefined();
    expect(files['apps/server/package.json']).toBeDefined();
  }
});

test('workspace linting excludes nested framework build output', () => {
  const files = buildTree(
    resolveStack({ backend: 'nest', frontend: 'tanstack-start' }),
    { projectName: 'lint-workspace', packageManager: 'bun' }
  );
  expect(files['eslint.config.mjs']).toContain('**/dist/**');
  expect(files['eslint.config.mjs']).toContain('**/.output/**');
});

test('separate workspaces keep private environment values with their server', () => {
  const files = buildTree(
    resolveStack({ backend: 'hono', frontend: 'tanstack-start' }),
    { projectName: 'owner-env', packageManager: 'bun' }
  );
  expect(files['.env']).toBeUndefined();
  expect(files['apps/server/.env']).toContain('DATABASE_URL=');
  expect(files['apps/web/.env']).toContain('VITE_SERVER_URL=');
  expect(files['apps/web/.env']).not.toContain('DATABASE_URL');
  expect(files['apps/server/src/index.ts']).toContain('import "./env.js"');
});

for (const packageManager of ['bun', 'npm', 'pnpm', 'yarn'] as const) {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    for (const backend of ['self', 'nest', 'hono', 'convex'] as const) {
      test(`${packageManager} ${frontend} ${backend} plain workspace has runnable package-owned tasks`, () => {
        const files = buildTree(
          resolveStack({
            frontend,
            backend,
            structure: 'monorepo',
            database: 'none',
            api: 'none',
            auth: 'none',
          }),
          { projectName: 'plain', packageManager }
        );
        const root = JSON.parse(files['package.json']);
        expect(root.devDependencies.turbo).toBeUndefined();
        expect(files['turbo.json']).toBeUndefined();
        expect(Object.values(files).join('\n')).not.toContain('turbo run');
        expect(files['.gitignore']).not.toContain('.turbo');
        expect(
          JSON.parse(files['apps/web/package.json']).scripts.typecheck
        ).toBe('tsc --noEmit');
        expect(files['scripts/workspace.mjs']).toBeDefined();
        if (backend === 'convex')
          expect(root.scripts['convex:dev']).toContain('node ');
        if (backend === 'self' || backend === 'convex')
          expect(files['apps/server/package.json']).toBeUndefined();
      });
    }
  }
}
