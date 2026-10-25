import { expect, test } from 'bun:test';

import {
  addReadmeSection,
  createProjectModel,
  type ProjectModel,
  renderProject,
} from '#/generate/project-model';
import { generateReadme } from '#/generate/readme';
import { resolveStack } from '#/stack/resolve';

test('renders ignore lines once each, in first-contributed order', () => {
  const project = createProjectModel();
  project.ignoreLines.push('node_modules', '.env*', '!.env.example');
  project.ignoreLines.push('node_modules', '.turbo', '.env*');

  expect(renderProject(project)['.gitignore']).toBe(
    'node_modules\n.env*\n!.env.example\n.turbo\n'
  );
});

test('renders no ignore file without ignore lines', () => {
  expect(renderProject(createProjectModel())).toEqual({});
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
