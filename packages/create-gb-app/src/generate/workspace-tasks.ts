import type { EmitCtx } from '../types/generate';
import { WORKSPACE_DRIVER } from './assets/workspace-driver';
import { DEPENDENCY_VERSIONS } from './dependency-versions';
import { setFile } from './files';

const byName = (left: string, right: string) => left.localeCompare(right);

export function prepareWorkspaceTasks(ctx: EmitCtx) {
  ctx.pkg.engines = { node: '>=22.12.0' };
  ctx.project.ignoreLines.push('.env*', '!.env.example', '.tanstack');
  const workspaces = Object.entries(ctx.project.manifests)
    .filter(([path]) => /^(apps|packages)\/[^/]+\/package.json$/.test(path))
    .map(([path, manifest]) => {
      const dir = path.slice(0, -'/package.json'.length);
      manifest.scripts ??= {};
      manifest.devDependencies ??= {};
      if (dir === 'apps/server') {
        manifest.dependencies ??= {};
        manifest.dependencies.dotenv = DEPENDENCY_VERSIONS.dotenv;
        setFile(
          ctx.files,
          dir + '/src/env.ts',
          "import { config } from 'dotenv';\n\nconfig({ path: ['.env.local', '.env'] });\n"
        );
        const entry =
          dir +
          (ctx.stack.backend === 'nest' ? '/src/main.ts' : '/src/index.ts');
        setFile(ctx.files, entry, 'import "./env.js";\n' + ctx.files[entry]);
      }
      const typed = ctx.files[dir + '/tsconfig.json'] !== undefined;
      const hasSource = Object.keys(ctx.files).some(
        (file) => file.startsWith(dir + '/') && /\.[jt]sx?$/.test(file)
      );
      if (typed) {
        manifest.scripts.typecheck ??= 'tsc --noEmit';
        manifest.devDependencies.typescript ??= DEPENDENCY_VERSIONS.typescript;
      }
      if (hasSource) {
        const linting = ctx.stack.addons.linting;
        const dependency = linting === 'biome' ? '@biomejs/biome' : linting;
        manifest.scripts.lint ??=
          linting === 'biome' ? 'biome lint .' : linting + ' .';
        manifest.devDependencies[dependency] ??=
          DEPENDENCY_VERSIONS[dependency];
      }
      return {
        name: manifest.name,
        dir,
        // Sorted like the rendered manifests, so emit order cannot leak in.
        tasks: Object.keys(manifest.scripts).sort(byName),
        dependencies: [
          ...Object.keys(manifest.dependencies ?? {}).sort(byName),
          ...Object.keys(manifest.devDependencies).sort(byName),
        ].filter((name, index, all) => all.indexOf(name) === index),
        ...(ctx.files[dir + '/src/router.tsx']
          ? { routeTree: 'src/routeTree.gen.ts' }
          : {}),
      };
    });
  const ordered: typeof workspaces = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(workspace: (typeof workspaces)[number]) {
    if (visited.has(workspace.name)) return;
    if (visiting.has(workspace.name))
      throw new Error('Workspace dependency cycle at ' + workspace.name);
    visiting.add(workspace.name);
    for (const name of workspace.dependencies) {
      const dependency = workspaces.find((entry) => entry.name === name);
      if (dependency) visit(dependency);
    }
    visiting.delete(workspace.name);
    visited.add(workspace.name);
    ordered.push(workspace);
  }
  for (const workspace of workspaces) visit(workspace);
  return ordered;
}
export function emitPlainWorkspace(
  ctx: EmitCtx,
  workspaces: ReturnType<typeof prepareWorkspaceTasks>
): void {
  ctx.pkg.scripts = {};
  for (const task of new Set(
    workspaces.flatMap((workspace) => workspace.tasks)
  )) {
    ctx.pkg.scripts[task] = 'node scripts/workspace.mjs ' + task;
  }
  setFile(ctx.files, 'scripts/workspace.mjs', WORKSPACE_DRIVER);
  setFile(
    ctx.files,
    'scripts/workspaces.json',
    JSON.stringify({ manager: ctx.packageManager, workspaces }, null, 2)
  );
}
