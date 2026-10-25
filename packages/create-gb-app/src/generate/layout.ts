import type { Stack } from '#/types/stack';

export type ProjectLayout = {
  structure: Stack['structure'];
  frontendRoot: '' | 'apps/web';
  backendRoot: '' | 'apps/web' | 'apps/server' | 'convex' | 'apps/web/convex';
  frontendManifest: 'package.json' | 'apps/web/package.json';
  backendManifest:
    | 'package.json'
    | 'apps/web/package.json'
    | 'apps/server/package.json'
    | null;
  sharedPackagesRoot: 'packages' | null;
  /** Frontend source directory: holds lib, components and the route tree. */
  sourceRoot: string;
  libDir: string;
  /** Where server-side code (auth, database client, schema) lives. */
  serverSourceRoot: string;
  authFile: string;
  dbFile: string;
  schemaFile: string;
  /** Package directory that owns `.env` and database tooling. */
  envOwner: '' | 'apps/web' | 'apps/server';
  stylesFile: string;
  /** Next root layout or Start root route. */
  rootLayout: string;
  providersFile: string;
  routesDir: string;
  /** Page for a named route; '' is the home route. */
  route: (name: string) => string;
  /** Frontend API handler for a named route, such as `stripe/webhook`. */
  apiRoute: (name: string) => string;
};

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export function projectLayout(stack: Stack): ProjectLayout {
  const single = stack.structure === 'single';
  const next = stack.frontend === 'next';
  const server = stack.backend === 'nest' || stack.backend === 'hono';
  const frontendRoot: ProjectLayout['frontendRoot'] = single ? '' : 'apps/web';
  const frontendManifest: ProjectLayout['frontendManifest'] = single
    ? 'package.json'
    : 'apps/web/package.json';
  const sourceRoot = joinPath(frontendRoot, next ? '' : 'src');
  const libDir = joinPath(sourceRoot, 'lib');
  const routesDir = joinPath(sourceRoot, next ? 'app' : 'routes');
  const serverSourceRoot = server ? 'apps/server/src' : libDir;
  const shared: Omit<
    ProjectLayout,
    'backendRoot' | 'backendManifest' | 'sharedPackagesRoot'
  > = {
    structure: stack.structure,
    frontendRoot,
    frontendManifest,
    sourceRoot,
    libDir,
    serverSourceRoot,
    authFile: joinPath(serverSourceRoot, 'auth.ts'),
    dbFile: joinPath(serverSourceRoot, 'db.ts'),
    schemaFile: joinPath(serverSourceRoot, 'schema.ts'),
    envOwner: server ? 'apps/server' : frontendRoot,
    stylesFile: next
      ? joinPath(routesDir, 'globals.css')
      : joinPath(sourceRoot, 'styles.css'),
    rootLayout: joinPath(routesDir, next ? 'layout.tsx' : '__root.tsx'),
    providersFile: next
      ? joinPath(routesDir, 'providers.tsx')
      : joinPath(sourceRoot, 'components/providers.tsx'),
    routesDir,
    route: (name: string) =>
      next
        ? joinPath(routesDir, name, 'page.tsx')
        : joinPath(routesDir, `${name || 'index'}.tsx`),
    apiRoute: (name: string) =>
      next
        ? joinPath(routesDir, 'api', name, 'route.ts')
        : joinPath(routesDir, 'api', `${name}.ts`),
  };

  if (server) {
    return {
      ...shared,
      backendRoot: 'apps/server',
      backendManifest: 'apps/server/package.json',
      sharedPackagesRoot: 'packages',
    };
  }
  if (stack.backend === 'convex') {
    return {
      ...shared,
      backendRoot: single ? 'convex' : 'apps/web/convex',
      backendManifest: null,
      sharedPackagesRoot: single ? null : 'packages',
    };
  }
  return {
    ...shared,
    backendRoot: frontendRoot,
    backendManifest: frontendManifest,
    sharedPackagesRoot: single ? null : 'packages',
  };
}
