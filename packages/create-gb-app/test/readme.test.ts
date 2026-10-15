import { expect, test } from 'bun:test';

import { buildTree } from '../src/generate/build-tree';
import { resolveStack, YES_DEFAULTS } from '../src/stack/resolve';

test('README documents the generated scripts and selected manager', () => {
  const files = buildTree(resolveStack(YES_DEFAULTS), {
    projectName: 'sample-app',
    packageManager: 'pnpm',
  });
  const readme = files['README.md'];

  expect(readme).toContain('pnpm install');
  expect(readme).toContain('pnpm run dev');
  expect(readme).toContain('pnpm run db:generate');
  expect(readme).toContain('## Features');
  expect(readme).not.toContain('## Project structure');
  expect(readme).not.toContain('pnpm run db:migrate');
});

test('README keeps hosted setup instructions once', () => {
  const files = buildTree(
    resolveStack({
      ...YES_DEFAULTS,
      database: 'sqlite',
      dbSetup: 'turso',
    }),
    { projectName: 'hosted-app', packageManager: 'bun' }
  );
  const readme = files['README.md'];

  expect(readme.match(/^## Database setup$/gm)).toHaveLength(1);
  expect(readme).toContain('turso db shell');
  expect(readme).toContain('bun run db:migrate');
});

for (const structure of ['single', 'turborepo'] as const) {
  for (const packageManager of ['bun', 'npm', 'pnpm', 'yarn'] as const) {
    test(`private Start README explains auth setup for ${structure} with ${packageManager}`, () => {
      const files = buildTree(
        resolveStack({
          frontend: 'tanstack-start',
          api: 'orpc',
          auth: 'better-auth',
          structure,
        }),
        { projectName: 'private-notes', packageManager }
      );
      const readme = files['README.md'];
      expect(readme).toContain('BETTER_AUTH_URL');
      expect(readme).toContain('http://localhost:3000');
      expect(readme).toContain('actual served origin');
      expect(readme).toContain('preview or production');
      expect(readme).toContain('BETTER_AUTH_SECRET');
      expect(readme).toContain(
        structure === 'single' ? '`.env`' : '`apps/web/.env`'
      );
    });
  }
}
