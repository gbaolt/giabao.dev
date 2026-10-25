import { expect, test } from 'bun:test';

import { createProjectModel, renderProject } from '#/generate/project-model';

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
