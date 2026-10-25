import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import type { prepareWorkspaceTasks } from '../workspace-tasks';

export function emitTurborepo(
  ctx: EmitCtx,
  workspaces: ReturnType<typeof prepareWorkspaceTasks>
): void {
  ctx.pkg.devDependencies.turbo = DEPENDENCY_VERSIONS.turbo;
  ctx.pkg.scripts = {};
  const environment = new Set([
    'NODE_ENV',
    'PORT',
    'SERVER_PORT',
    'HOST',
    'NEXT_PUBLIC_*',
    'VITE_*',
  ]);
  for (const [path, source] of Object.entries(ctx.files)) {
    if (!/(^|\/)\.env(?:\.|$)/.test(path)) continue;
    for (const match of source.matchAll(/^([A-Z][A-Z0-9_]*)=/gm))
      environment.add(match[1]);
  }
  const tasks: Record<string, object> = {
    build: {
      dependsOn: ['^build'],
      inputs: ['$TURBO_DEFAULT$', '.env*'],
      outputs: ['dist/**'],
    },
    dev: { dependsOn: ['^build'], cache: false, persistent: true },
    start: { dependsOn: ['^build'], cache: false, persistent: true },
    lint: { dependsOn: ['^lint'] },
    typecheck: { dependsOn: ['^build'], cache: false },
  };
  for (const task of new Set(
    workspaces.flatMap((workspace) => workspace.tasks)
  )) {
    ctx.pkg.scripts[task] = 'turbo run ' + task;
    tasks[task] ??=
      task === 'convex:dev'
        ? { dependsOn: ['^build'], cache: false, persistent: true }
        : { cache: false };
  }
  tasks['web#build'] = {
    ...tasks.build,
    outputs:
      ctx.stack.frontend === 'next'
        ? ['.next/**', '!.next/cache/**', '!.next/dev/**', 'next-env.d.ts']
        : ['dist/**', 'src/routeTree.gen.ts'],
  };
  if (ctx.stack.frontend === 'tanstack-start')
    tasks['web#typecheck'] = { dependsOn: ['build'], cache: false };
  const configInputs = Object.keys(ctx.files).filter(
    (path) => !path.includes('/') && /(?:eslint|oxlint|biome)/.test(path)
  );
  setFile(
    ctx.files,
    'turbo.json',
    JSON.stringify(
      {
        $schema: 'https://turborepo.dev/schema.json',
        globalDependencies: configInputs,
        globalEnv: [...environment].sort(),
        tasks,
      },
      null,
      2
    )
  );
  ctx.project.ignoreLines.push('.turbo');
}
