import type { EmitCtx } from '../types/generate';
import { WORKSPACE_DRIVER } from './assets/workspace-driver';
import { DEPENDENCY_VERSIONS } from './dependency-versions';
import { setFile } from './files';

type WorkspaceManifest = {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
export function prepareWorkspaceTasks(ctx: EmitCtx) {
  ctx.pkg.engines = { node: '>=22.12.0' };
  if (!ctx.files['.gitignore'])
    setFile(
      ctx.files,
      '.gitignore',
      'node_modules\ndist\n.next\n.output\n.env*\n!.env.example\n*.log\n'
    );
  setFile(
    ctx.files,
    '.gitignore',
    ctx.files['.gitignore'].trimEnd() + '\n.env*\n!.env.example\n.tanstack\n'
  );
  const workspaces = Object.entries(ctx.files)
    .filter(([path]) => /^(apps|packages)\/[^/]+\/package.json$/.test(path))
    .map(([path, source]) => {
      const manifest: WorkspaceManifest = JSON.parse(source);
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
      setFile(ctx.files, path, JSON.stringify(manifest, null, 2));
      return {
        name: manifest.name,
        dir,
        tasks: Object.keys(manifest.scripts),
        dependencies: Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
        }),
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
