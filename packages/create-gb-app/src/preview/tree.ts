import type { Stack } from '#/types/stack';

export function previewTree(stack: Stack): string {
  if (stack.structure === 'monorepo') {
    const rows = ['apps/web'];
    if (stack.backend === 'nest' || stack.backend === 'hono')
      rows.push('apps/server');
    if (stack.backend === 'convex') rows.push('apps/web/convex');
    if (
      (stack.backend === 'nest' || stack.backend === 'hono') &&
      stack.api !== 'none'
    ) {
      rows.push('packages/contract');
    }
    rows.push(
      'packages/typescript-config',
      'packages/ui',
      'packages/validation',
      stack.addons.taskRunner === 'turborepo' ? 'turbo.json' : 'scripts/workspace.mjs'
    );
    return rows.join('\n');
  }

  const rows = [stack.frontend === 'next' ? 'app' : 'src/routes'];
  if (stack.backend === 'convex') {
    rows.push('convex');
  } else if (stack.database !== 'none') {
    rows.push(stack.frontend === 'next' ? 'lib' : 'src/server');
    if (stack.orm === 'prisma') {
      rows.push('prisma');
    }
  }
  rows.push('package.json');
  return rows.join('\n');
}
