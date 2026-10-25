import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

function build(flags: RawFlags) {
  return buildTree(resolveStack(flags), {
    projectName: 'payments-app',
    packageManager: 'bun',
  });
}

for (const [flags, manifest] of [
  [{}, 'package.json'],
  [{ backend: 'nest' }, 'apps/server/package.json'],
  [{ backend: 'hono', frontend: 'tanstack-start' }, 'apps/server/package.json'],
  [{ structure: 'monorepo', backend: 'self' }, 'apps/web/package.json'],
] satisfies [RawFlags, string][]) {
  test(`Polar depends on its Better Auth plugin in ${manifest} for ${JSON.stringify(flags)}`, () => {
    const files = build({ ...flags, auth: 'better-auth', payments: 'polar' });
    const owners = Object.entries(files)
      .filter(([path]) => path.endsWith('package.json'))
      .filter(
        ([, source]) =>
          '@polar-sh/better-auth' in (JSON.parse(source).dependencies ?? {})
      )
      .map(([path]) => path);

    expect(owners).toEqual([manifest]);
  });
}

for (const [structure, path] of [
  ['single', 'convex/betterAuth.ts'],
  ['monorepo', 'apps/web/convex/betterAuth.ts'],
] as const) {
  test(`Convex Better Auth registers the Polar plugin in a ${structure} app`, () => {
    const auth = build({
      backend: 'convex',
      structure,
      auth: 'better-auth',
      payments: 'polar',
    })[path];

    expect(auth).toContain("import { polar } from '@polar-sh/better-auth';");
    expect(auth).toMatch(/plugins: \[\s*polar\(\{[\s\S]*\}\),\s*convex\(\)\]/);
  });
}

for (const payments of ['stripe', 'polar'] as const)
  for (const [flags, path] of [
    [{ frontend: 'tanstack-start', api: 'trpc' }, 'src/routes/portal.tsx'],
    [
      { frontend: 'tanstack-start', backend: 'nest' },
      'apps/web/src/routes/portal.tsx',
    ],
  ] satisfies [RawFlags, string][]) {
    test(`${payments} writes ${path} as a Start file route`, () => {
      const page = build({ ...flags, auth: 'better-auth', payments })[path];

      expect(page).toStartWith(
        'import { createFileRoute } from "@tanstack/react-router";\n\nexport const Route = createFileRoute("/portal")({\n  component: PortalPage,\n});\n\nfunction PortalPage() {\n'
      );
      expect(page).not.toContain('export default');
    });
  }
