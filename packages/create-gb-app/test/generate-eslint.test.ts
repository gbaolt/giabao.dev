import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';

for (const structure of ['single', 'turborepo'] as const) {
  test(`${structure} ESLint config and plugins sit at the project root`, () => {
    const files = buildTree(resolveStack({ structure }), {
      projectName: 'lint-fixture',
      packageManager: 'bun',
    });
    const workspace = structure === 'turborepo';
    const pkg = JSON.parse(
      files[workspace ? 'apps/web/package.json' : 'package.json']!
    );
    const root = JSON.parse(files['package.json']!);
    for (const [name, version] of [
      ['eslint-plugin-react-hooks', '^5.0.0'],
      ['@next/eslint-plugin-next', '^15.5.4'],
    ]) {
      expect(root.devDependencies[name]).toBe(workspace ? 'catalog:' : version);
      if (workspace) {
        expect(root.workspaces.catalog[name]).toBe(version);
        expect(pkg.devDependencies[name]).toBeUndefined();
      }
    }
    // The shared packages lint with this config by walking up from their folder.
    expect(files['eslint.config.mjs']).toContain('next/core-web-vitals');
    expect(files['eslint.config.mjs']).toContain('next-env.d.ts');
    expect(files['apps/web/eslint.config.mjs']).toBeUndefined();
    expect(files['prettier.config.mjs']).toBeUndefined();
    expect(pkg.devDependencies.prettier).toBeUndefined();
    expect(pkg.devDependencies['eslint-config-prettier']).toBeUndefined();
    expect(pkg.devDependencies.oxfmt).toBeUndefined();
    expect(pkg.scripts.format).toBeUndefined();
  });
}

test('Start ESLint uses React and TypeScript without the Next parser', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      api: 'none',
      auth: 'none',
      database: 'none',
    }),
    { projectName: 'start-lint', packageManager: 'bun' }
  );
  const pkg = JSON.parse(files['package.json']!);
  expect(pkg.devDependencies['eslint-config-next']).toBeUndefined();
  expect(pkg.devDependencies['@typescript-eslint/parser']).toBeDefined();
  expect(pkg.devDependencies['@typescript-eslint/eslint-plugin']).toBeDefined();
  expect(pkg.devDependencies['eslint-plugin-react']).toBeDefined();
  expect(files['eslint.config.mjs']).toContain('plugin:react/jsx-runtime');
  expect(files['eslint.config.mjs']).not.toContain('next/core-web-vitals');
  expect(files['eslint.config.mjs']).toContain('dist/**');
  expect(files['src/routes/index.tsx']).not.toContain('import { Link,');
});

test('generated lint choices do not install or expose a formatter', () => {
  for (const linter of ['eslint', 'biome', 'oxlint'] as const) {
    const files = buildTree(resolveStack({ backend: 'nest', linter }), {
      projectName: 'lint-only',
      packageManager: 'bun',
    });

    for (const [path, source] of Object.entries(files)) {
      if (!path.endsWith('package.json')) continue;
      const pkg = JSON.parse(source);
      expect(pkg.scripts?.format).toBeUndefined();
      expect(pkg.devDependencies?.prettier).toBeUndefined();
      expect(pkg.devDependencies?.oxfmt).toBeUndefined();
    }

    expect(files['prettier.config.mjs']).toBeUndefined();
    if (linter === 'biome') {
      expect(JSON.parse(files['biome.json']!).formatter.enabled).toBe(false);
    }
  }
});
