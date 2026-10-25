import { expect, test } from 'bun:test';

import { projectLayout } from '#/generate/layout';
import {
  addEnv,
  addReadmeSection,
  createProjectModel,
  type ProjectModel,
  renderProject,
} from '#/generate/project-model';
import { generateReadme } from '#/generate/readme';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

function render(project: ProjectModel, flags: RawFlags = {}) {
  const stack = resolveStack(flags);
  return renderProject(project, { stack, layout: projectLayout(stack) });
}

test('renders ignore lines once each, in first-contributed order', () => {
  const project = createProjectModel();
  project.ignoreLines.push('node_modules', '.env*', '!.env.example');
  project.ignoreLines.push('node_modules', '.turbo', '.env*');

  expect(render(project)['.gitignore']).toBe(
    'node_modules\n.env*\n!.env.example\n.turbo\n'
  );
});

test('renders no files from an empty project model', () => {
  expect(render(createProjectModel())).toEqual({});
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

test('rejects a second writer of one README section', () => {
  const project = createProjectModel();
  addReadmeSection(project, 'configuration-notes', 'First.');

  expect(() =>
    addReadmeSection(project, 'configuration-notes', 'Second.')
  ).toThrow('configuration-notes');
});
