import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { projectLayout } from '#/generate/layout';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

const ctx = { projectName: 'layout-app', packageManager: 'bun' } as const;

function roles(flags: RawFlags) {
  const layout = projectLayout(resolveStack(flags));
  return {
    frontendRoot: layout.frontendRoot,
    backendRoot: layout.backendRoot,
    frontendManifest: layout.frontendManifest,
    backendManifest: layout.backendManifest,
    sharedPackagesRoot: layout.sharedPackagesRoot,
    sourceRoot: layout.sourceRoot,
    libDir: layout.libDir,
    serverSourceRoot: layout.serverSourceRoot,
    authFile: layout.authFile,
    dbFile: layout.dbFile,
    schemaFile: layout.schemaFile,
    envOwner: layout.envOwner,
    stylesFile: layout.stylesFile,
    rootLayout: layout.rootLayout,
    providersFile: layout.providersFile,
    routesDir: layout.routesDir,
    home: layout.route(''),
    notes: layout.route('notes'),
    webhook: layout.apiRoute('stripe/webhook'),
  };
}

const next = {
  stylesFile: 'app/globals.css',
  rootLayout: 'app/layout.tsx',
  providersFile: 'app/providers.tsx',
  routesDir: 'app',
  home: 'app/page.tsx',
  notes: 'app/notes/page.tsx',
  webhook: 'app/api/stripe/webhook/route.ts',
};
const start = {
  stylesFile: 'src/styles.css',
  rootLayout: 'src/routes/__root.tsx',
  providersFile: 'src/components/providers.tsx',
  routesDir: 'src/routes',
  home: 'src/routes/index.tsx',
  notes: 'src/routes/notes.tsx',
  webhook: 'src/routes/api/stripe/webhook.ts',
};
const prefixed = (prefix: string, paths: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(paths).map(([role, path]) => [role, `${prefix}/${path}`])
  );

const server = {
  backendRoot: 'apps/server',
  backendManifest: 'apps/server/package.json',
  serverSourceRoot: 'apps/server/src',
  authFile: 'apps/server/src/auth.ts',
  dbFile: 'apps/server/src/db.ts',
  schemaFile: 'apps/server/src/schema.ts',
  envOwner: 'apps/server',
};

const table: Array<[RawFlags, Record<string, string | null>]> = [
  [
    { structure: 'single', backend: 'self', frontend: 'next' },
    {
      frontendRoot: '',
      backendRoot: '',
      frontendManifest: 'package.json',
      backendManifest: 'package.json',
      sharedPackagesRoot: null,
      sourceRoot: '',
      libDir: 'lib',
      serverSourceRoot: 'lib',
      authFile: 'lib/auth.ts',
      dbFile: 'lib/db.ts',
      schemaFile: 'lib/schema.ts',
      envOwner: '',
      ...next,
    },
  ],
  [
    { structure: 'single', backend: 'self', frontend: 'tanstack-start' },
    {
      frontendRoot: '',
      backendRoot: '',
      frontendManifest: 'package.json',
      backendManifest: 'package.json',
      sharedPackagesRoot: null,
      sourceRoot: 'src',
      libDir: 'src/lib',
      serverSourceRoot: 'src/lib',
      authFile: 'src/lib/auth.ts',
      dbFile: 'src/lib/db.ts',
      schemaFile: 'src/lib/schema.ts',
      envOwner: '',
      ...start,
    },
  ],
  [
    { structure: 'single', backend: 'convex', frontend: 'next' },
    {
      frontendRoot: '',
      backendRoot: 'convex',
      frontendManifest: 'package.json',
      backendManifest: null,
      sharedPackagesRoot: null,
      sourceRoot: '',
      libDir: 'lib',
      serverSourceRoot: 'lib',
      authFile: 'lib/auth.ts',
      dbFile: 'lib/db.ts',
      schemaFile: 'lib/schema.ts',
      envOwner: '',
      ...next,
    },
  ],
  [
    { structure: 'single', backend: 'convex', frontend: 'tanstack-start' },
    {
      frontendRoot: '',
      backendRoot: 'convex',
      frontendManifest: 'package.json',
      backendManifest: null,
      sharedPackagesRoot: null,
      sourceRoot: 'src',
      libDir: 'src/lib',
      serverSourceRoot: 'src/lib',
      authFile: 'src/lib/auth.ts',
      dbFile: 'src/lib/db.ts',
      schemaFile: 'src/lib/schema.ts',
      envOwner: '',
      ...start,
    },
  ],
  [
    { structure: 'monorepo', backend: 'self', frontend: 'next' },
    {
      frontendRoot: 'apps/web',
      backendRoot: 'apps/web',
      frontendManifest: 'apps/web/package.json',
      backendManifest: 'apps/web/package.json',
      sharedPackagesRoot: 'packages',
      sourceRoot: 'apps/web',
      libDir: 'apps/web/lib',
      serverSourceRoot: 'apps/web/lib',
      authFile: 'apps/web/lib/auth.ts',
      dbFile: 'apps/web/lib/db.ts',
      schemaFile: 'apps/web/lib/schema.ts',
      envOwner: 'apps/web',
      ...prefixed('apps/web', next),
    },
  ],
  [
    { structure: 'monorepo', backend: 'convex', frontend: 'tanstack-start' },
    {
      frontendRoot: 'apps/web',
      backendRoot: 'apps/web/convex',
      frontendManifest: 'apps/web/package.json',
      backendManifest: null,
      sharedPackagesRoot: 'packages',
      sourceRoot: 'apps/web/src',
      libDir: 'apps/web/src/lib',
      serverSourceRoot: 'apps/web/src/lib',
      authFile: 'apps/web/src/lib/auth.ts',
      dbFile: 'apps/web/src/lib/db.ts',
      schemaFile: 'apps/web/src/lib/schema.ts',
      envOwner: 'apps/web',
      ...prefixed('apps/web', start),
    },
  ],
  ...(['nest', 'hono'] as const).flatMap(
    (backend): Array<[RawFlags, Record<string, string | null>]> => [
      [
        { structure: 'monorepo', backend, frontend: 'next' },
        {
          frontendRoot: 'apps/web',
          frontendManifest: 'apps/web/package.json',
          sharedPackagesRoot: 'packages',
          sourceRoot: 'apps/web',
          libDir: 'apps/web/lib',
          ...server,
          ...prefixed('apps/web', next),
        },
      ],
      [
        { structure: 'monorepo', backend, frontend: 'tanstack-start' },
        {
          frontendRoot: 'apps/web',
          frontendManifest: 'apps/web/package.json',
          sharedPackagesRoot: 'packages',
          sourceRoot: 'apps/web/src',
          libDir: 'apps/web/src/lib',
          ...server,
          ...prefixed('apps/web', start),
        },
      ],
    ]
  ),
];

for (const [flags, expected] of table) {
  test(`layout roles for ${flags.structure} ${flags.backend} ${flags.frontend}`, () => {
    expect(roles(flags)).toEqual(expected as ReturnType<typeof roles>);
  });
}

for (const payments of ['stripe', 'polar'] as const) {
  test(`Start monorepo with ${payments} writes the portal as a Start route`, () => {
    const files = buildTree(
      resolveStack({
        structure: 'monorepo',
        backend: 'nest',
        frontend: 'tanstack-start',
        auth: 'better-auth',
        payments,
      }),
      ctx
    );
    expect(files['apps/web/src/routes/portal.tsx']).toContain('PortalPage');
    expect(files['apps/web/app/portal/page.tsx']).toBeUndefined();
  });
}
