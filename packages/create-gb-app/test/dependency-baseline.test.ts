import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';
import type { RawFlags } from '#/types/stack';

test('generated oRPC applications use the same explicit release set', () => {
  const configurations = [
    { yes: true },
    { backend: 'nest', frontend: 'tanstack-start' },
  ] satisfies RawFlags[];
  for (const flags of configurations) {
    const files = buildTree(resolveStack(flags), {
      projectName: 'dependency-baseline',
      packageManager: 'bun',
    });
    const versions: string[] = [];
    const root = JSON.parse(files['package.json']);
    for (const [path, source] of Object.entries(files)) {
      if (!path.endsWith('package.json')) continue;
      const manifest = JSON.parse(source);
      for (const [name, version] of Object.entries(
        manifest.dependencies ?? {}
      )) {
        if (name.startsWith('@orpc/'))
          versions.push(
            String(
              version === 'catalog:' ? root.workspaces.catalog[name] : version
            )
          );
      }
    }
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set(['2.0.0-beta.43']));
  }
});

test('Nest contracts expose a built single-file package for the Node server', () => {
  const files = buildTree(
    resolveStack({ backend: 'nest', frontend: 'tanstack-start' }),
    {
      projectName: 'node-contract',
      packageManager: 'bun',
    }
  );
  const contract = JSON.parse(files['packages/contract/package.json']);
  expect(contract.exports['.'].default).toBe('./dist/index.js');
  expect(contract.exports['.'].types).toBe('./dist/index.d.ts');
  expect(contract.scripts.build).toBe('tsc -p tsconfig.json');
  expect(files['packages/contract/src/index.ts']).toContain(
    'export const contract'
  );
  expect(files['packages/contract/src/contract.ts']).toBeUndefined();
});
