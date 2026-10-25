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
