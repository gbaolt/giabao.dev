import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';

for (const packageManager of ['bun', 'npm', 'pnpm', 'yarn'] as const) {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    for (const backend of ['self', 'nest', 'hono', 'convex'] as const) {
      test(`${packageManager} ${frontend} ${backend} Turbo changes orchestration only`, () => {
        const flags = {
          frontend,
          backend,
          structure: 'monorepo',
          database: 'none',
          api: 'none',
          auth: 'none',
        } as const;
        const context = { projectName: 'turbo-addon', packageManager };
        const plain = buildTree(resolveStack(flags), context);
        const turbo = buildTree(
          resolveStack({ ...flags, addons: { taskRunner: 'turborepo' } }),
          context
        );
        for (const path of Object.keys(plain).filter((path) =>
          /^(apps|packages)\//.test(path)
        )) {
          expect(turbo[path], path).toBe(plain[path]);
        }
        const root = JSON.parse(turbo['package.json']);
        for (const task of ['build', 'dev', 'start', 'lint', 'typecheck'])
          expect(root.scripts[task]).toBe(`turbo run ${task}`);
        expect(root.devDependencies.turbo).toBeDefined();
        expect(turbo['.gitignore']).toContain('.turbo');
        expect(turbo['scripts/workspace.mjs']).toBeUndefined();
        const tasks = JSON.parse(turbo['turbo.json']).tasks;
        expect(tasks.build.dependsOn).toContain('^build');
        for (const name of ['dev', 'start']) {
          expect(tasks[name].cache).toBe(false);
          expect(tasks[name].persistent).toBe(true);
          expect(tasks[name].dependsOn).toContain('^build');
        }
        expect(tasks.typecheck.dependsOn).toContain('^build');
        if (backend === 'convex') {
          expect(tasks['convex:dev'].persistent).toBe(true);
          expect(tasks['convex:codegen'].cache).toBe(false);
        }
      });
    }
  }
}

test('Turbo hashes local environment and passes selected runtime variables', () => {
  const files = buildTree(
    resolveStack({ backend: 'nest', addons: { taskRunner: 'turborepo' } }),
    { projectName: 'env-turbo', packageManager: 'bun' }
  );
  const config = JSON.parse(files['turbo.json']);
  expect(config.tasks.build.inputs).toContain('.env*');
  for (const name of [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'NEXT_PUBLIC_*',
    'VITE_*',
    'PORT',
    'SERVER_PORT',
    'HOST',
  ])
    expect(config.globalEnv).toContain(name);
  expect(config.tasks['db:push'].cache).toBe(false);
  expect(config.tasks['web#build'].outputs).toContain('!.next/cache/**');
  expect(config.tasks['web#build'].outputs).toContain('!.next/dev/**');
  expect(config.globalDependencies).toContain('eslint.config.mjs');
});
