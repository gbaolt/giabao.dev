import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';

test('workspace output installs with the selected manager and builds shared dependencies before dev', () => {
  for (const packageManager of ['bun', 'pnpm', 'yarn', 'npm'] as const) {
    const files = buildTree(
      resolveStack({
        backend: 'hono', addons: { taskRunner: 'turborepo' },
        database: 'none',
        auth: 'none',
        api: 'none',
      }),
      {
        projectName: 'manager-workspace',
        packageManager,
      }
    );
    const root = JSON.parse(files['package.json']);
    const web = JSON.parse(files['apps/web/package.json']);
    expect(JSON.parse(files['turbo.json']).tasks.dev.dependsOn).toContain(
      '^build'
    );
    expect(web.dependencies['@repo/ui']).toBe(
      packageManager === 'npm' ? '*' : 'workspace:*'
    );
    if (packageManager === 'bun') {
      expect(root.workspaces.packages).toEqual(['apps/*', 'packages/*']);
      expect(root.workspaces.catalog.react).toBe('^19.1.1');
    } else if (packageManager === 'pnpm') {
      expect(files['pnpm-workspace.yaml']).toContain('catalog:');
      expect(files['pnpm-workspace.yaml']).toContain('"react": "^19.1.1"');
    } else if (packageManager === 'yarn') {
      expect(root.packageManager).toBe('yarn@4.11.0');
      expect(files['.yarnrc.yml']).toContain('nodeLinker: node-modules');
      expect(files['.yarnrc.yml']).toContain('catalog:');
    } else {
      expect(Object.values(files).join('\n')).not.toContain('catalog:');
      expect(Object.values(files).join('\n')).not.toContain('workspace:*');
    }
    expect(web.dependencies.react).toBe(
      packageManager === 'npm' ? '^19.1.1' : 'catalog:'
    );
    expect(
      JSON.parse(files['packages/ui/package.json']).dependencies.react
    ).toBe(web.dependencies.react);
    for (const [path, source] of Object.entries(files)) {
      if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
      const owner =
        path.startsWith('apps/') || path.startsWith('packages/')
          ? path.split('/').slice(0, 2).join('/')
          : '';
      const manifest = JSON.parse(
        files[owner ? `${owner}/package.json` : 'package.json']
      );
      for (const [, dependency] of source.matchAll(
        /(?:from\s*|import\s*\()['"](@repo\/[^/'"]+)/g
      )) {
        if (dependency === manifest.name) continue;
        expect(
          manifest.dependencies?.[dependency],
          `${path} imports ${dependency}`
        ).toBeDefined();
      }
    }
  }
});
