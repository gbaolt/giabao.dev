import { expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { DEPENDENCY_VERSIONS } from '#/generate/dependency-versions';
import { emitBetterAuth } from '#/generate/layers/better-auth';
import { emitNext } from '#/generate/layers/next';
import { emitPolar } from '#/generate/layers/polar';
import { emitShadcn } from '#/generate/layers/shadcn';
import { emitStart } from '#/generate/layers/start';
import { projectLayout } from '#/generate/layout';
import {
  addDependencies,
  addEnv,
  addReadmeSection,
  createProjectModel,
  type ProjectModel,
  renderProject,
  setProviders,
} from '#/generate/project-model';
import { generateReadme } from '#/generate/readme';
import { resolveStack } from '#/stack/resolve';
import type { EmitCtx } from '#/types/generate';
import type { RawFlags } from '#/types/stack';

function render(project: ProjectModel, flags: RawFlags = {}) {
  const stack = resolveStack(flags);
  return renderProject(project, {
    layout: projectLayout(stack),
    packageManager: 'bun',
  });
}

test('renders ignore lines once each, in first-contributed order', () => {
  const project = createProjectModel();
  project.ignoreLines.push('node_modules', '.env*', '!.env.example');
  project.ignoreLines.push('node_modules', '.turbo', '.env*');

  expect(render(project)['.gitignore']).toBe(
    'node_modules\n.env*\n!.env.example\n.turbo\n'
  );
});

test('renders only the providers file from an empty project model', () => {
  expect(Object.keys(render(createProjectModel()))).toEqual([
    'app/providers.tsx',
  ]);
});

test('renders a single app env file and its example', () => {
  const project = createProjectModel();
  addEnv(project, { DATABASE_URL: 'file:./dev.db' });
  addEnv(project, { STRIPE_SECRET_KEY: 'sk_test' });
  const files = render(project);

  expect(files['.env']).toBe(
    'DATABASE_URL="file:./dev.db"\nSTRIPE_SECRET_KEY="sk_test"\n'
  );
  expect(files['.env.example']).toBe(files['.env']);
});

test('splits public env entries into the web workspace of a server backend', () => {
  const project = createProjectModel();
  addEnv(project, {
    DATABASE_URL: 'postgres://db',
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:3333',
    VITE_SERVER_URL: 'http://localhost:3333',
  });
  const files = render(project, { backend: 'nest' });

  expect(files['apps/server/.env']).toContain('DATABASE_URL="postgres://db"');
  expect(files['apps/web/.env']).toBe(
    'NEXT_PUBLIC_SERVER_URL="http://localhost:3333"\nVITE_SERVER_URL="http://localhost:3333"\n'
  );
  expect(files['.env']).toBeUndefined();
});

test('renders manifests sorted, with workspace links and a shared catalog', () => {
  const project = createProjectModel();
  project.manifests['package.json'] = {
    name: 'model-app',
    private: true,
    type: 'module',
    scripts: { lint: 'turbo run lint', dev: 'turbo run dev' },
    dependencies: {},
    devDependencies: { turbo: DEPENDENCY_VERSIONS.turbo },
    workspaces: ['apps/*', 'packages/*'],
  };
  project.manifests['apps/web/package.json'] = { name: 'web' };
  addDependencies(project, 'apps/web/package.json', {
    react: DEPENDENCY_VERSIONS.react,
    '@repo/ui': 'workspace:*',
  });
  project.manifests['packages/ui/package.json'] = { name: '@repo/ui' };
  const files = render(project, { backend: 'nest' });

  expect(JSON.parse(files['apps/web/package.json'])).toEqual({
    name: 'web',
    dependencies: { '@repo/ui': 'workspace:*', react: 'catalog:' },
  });
  expect(Object.keys(JSON.parse(files['package.json']).scripts)).toEqual([
    'dev',
    'lint',
  ]);
  expect(JSON.parse(files['package.json']).workspaces.catalog).toEqual({
    react: DEPENDENCY_VERSIONS.react,
    turbo: DEPENDENCY_VERSIONS.turbo,
  });
});

function emitInOrder(flags: RawFlags, modules: ((ctx: EmitCtx) => void)[]) {
  const stack = resolveStack(flags);
  const layout = projectLayout(stack);
  const project = createProjectModel();
  const pkg: EmitCtx['pkg'] = {
    name: 'model-app',
    private: true,
    type: 'module',
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
  project.manifests['package.json'] = pkg;
  for (const path of [layout.frontendManifest, layout.backendManifest])
    if (path) project.manifests[path] ??= { name: path };
  const files: Record<string, string> = {};
  const ctx: EmitCtx = {
    projectName: 'model-app',
    packageManager: 'bun',
    files,
    pkg,
    stack,
    layout,
    project,
  };
  for (const emit of modules) emit(ctx);
  return {
    ...files,
    ...renderProject(project, { layout, packageManager: 'bun' }),
  };
}

for (const flags of [
  { auth: 'better-auth', payments: 'polar' },
  { backend: 'nest', auth: 'better-auth', payments: 'polar' },
] satisfies RawFlags[]) {
  test(`registers the Polar plugin in either emit order for ${flags.backend ?? 'self'}`, () => {
    const authFirst = emitInOrder(flags, [emitBetterAuth, emitPolar]);
    const polarFirst = emitInOrder(flags, [emitPolar, emitBetterAuth]);
    const authFile = projectLayout(resolveStack(flags)).authFile;

    expect(polarFirst).toEqual(authFirst);
    expect(authFirst[authFile]).toMatch(
      /import \{ checkout, polar \} from ["']@polar-sh\/better-auth["'];/
    );
    expect(authFirst[authFile]).toContain('polar({');
  });
}

for (const frontend of ['next', 'tanstack-start'] as const) {
  test(`wraps the ${frontend} root document in either emit order`, () => {
    const flags = { frontend, api: 'none', auth: 'none' } satisfies RawFlags;
    const frontendFirst = emitInOrder(flags, [
      frontend === 'next' ? emitNext : emitStart,
      emitShadcn,
    ]);
    const shadcnFirst = emitInOrder(flags, [
      emitShadcn,
      frontend === 'next' ? emitNext : emitStart,
    ]);
    const document = projectLayout(resolveStack(flags)).rootLayout;

    expect(shadcnFirst[document]).toBe(frontendFirst[document]!);
    expect(frontendFirst[document]).toContain('<ThemeProvider>');
    expect(frontendFirst[document]).toContain('suppressHydrationWarning');
  });
}

test('renders pass-through providers when no emit module contributes any', () => {
  const files = render(createProjectModel());

  expect(files['app/providers.tsx']).toContain(
    'export function Providers({ children }: { children: ReactNode })'
  );
});

test('renders contributed providers under the frontend root', () => {
  const project = createProjectModel();
  setProviders(project, 'export function Providers() {}\n');

  expect(render(project, { backend: 'nest' })['apps/web/app/providers.tsx']).toBe(
    'export function Providers() {}\n'
  );
  expect(() => setProviders(project, 'again')).toThrow('providers');
});

test('rejects a second writer of one env entry', () => {
  const project = createProjectModel();
  addEnv(project, { DATABASE_URL: 'a' });

  expect(() => addEnv(project, { DATABASE_URL: 'b' })).toThrow('DATABASE_URL');
});

function readmeOf(project: ProjectModel) {
  return generateReadme(
    resolveStack({ backend: 'hono', api: 'none', auth: 'none' }),
    { projectName: 'model-app', packageManager: 'bun' },
    {},
    {
      name: 'model-app',
      private: true,
      type: 'module',
      scripts: { dev: 'turbo run dev' },
      dependencies: {},
      devDependencies: {},
    },
    project.readmeSections
  );
}

test('renders README sections in a fixed order, whoever contributes first', () => {
  const project = createProjectModel();
  addReadmeSection(project, 'hosted-database', 'Copy the URL.');
  addReadmeSection(project, 'configuration-notes', 'The server listens.');
  const readme = readmeOf(project);

  expect(readme).toContain(
    '## Configuration notes\n\nThe server listens.\n\n## Database setup\n\nCopy the URL.\n\n## Start developing'
  );
  expect(readme.match(/^## Database setup$/gm)).toHaveLength(1);
});

test('renders the generated database setup without hosted guidance', () => {
  const readme = readmeOf(createProjectModel());

  expect(readme).toContain('## Database setup\n\nSet the database connection');
  expect(readme).not.toContain('## Configuration notes');
});

function build(flags: RawFlags) {
  return buildTree(resolveStack(flags), {
    projectName: 'model-app',
    packageManager: 'bun',
  });
}

for (const flags of [
  {},
  { backend: 'nest' },
  { structure: 'monorepo', backend: 'self' },
] satisfies RawFlags[]) {
  test(`ends every manifest with a newline for ${JSON.stringify(flags)}`, () => {
    const manifests = Object.entries(build(flags)).filter(([path]) =>
      path.endsWith('package.json')
    );

    expect(manifests.length).toBeGreaterThan(0);
    for (const [path, source] of manifests)
      expect([path, source.endsWith('}\n')]).toEqual([path, true]);
  });
}

test('rejects a second writer of one README section', () => {
  const project = createProjectModel();
  addReadmeSection(project, 'configuration-notes', 'First.');

  expect(() =>
    addReadmeSection(project, 'configuration-notes', 'Second.')
  ).toThrow('configuration-notes');
});
