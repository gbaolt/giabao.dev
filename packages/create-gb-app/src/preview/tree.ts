import { projectLayout } from '#/generate/layout';
import type { Stack } from '#/types/stack';

export function previewTree(stack: Stack): string {
  const layout = projectLayout(stack);
  if (layout.sharedPackagesRoot) {
    const rows: string[] = [layout.frontendRoot];
    if (layout.backendRoot !== layout.frontendRoot)
      rows.push(layout.backendRoot);
    if (
      (stack.backend === 'nest' || stack.backend === 'hono') &&
      stack.api !== 'none'
    ) {
      rows.push(`${layout.sharedPackagesRoot}/contract`);
    }
    rows.push(
      ...['typescript-config', 'ui', 'validation'].map(
        (name) => `${layout.sharedPackagesRoot}/${name}`
      ),
      stack.addons.taskRunner === 'turborepo'
        ? 'turbo.json'
        : 'scripts/workspace.mjs'
    );
    return rows.join('\n');
  }

  const rows: string[] = [layout.routesDir];
  if (stack.backend === 'convex') {
    rows.push(layout.backendRoot);
  } else if (stack.database !== 'none') {
    rows.push(layout.serverSourceRoot);
    if (stack.orm === 'prisma') {
      rows.push('prisma');
    }
  }
  rows.push(layout.frontendManifest);
  return rows.join('\n');
}
