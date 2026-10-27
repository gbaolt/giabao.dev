import { expect, test } from 'bun:test';

import { formatCommand } from '#/preview/command';
test('quotes directory names with spaces', () => {
  expect(formatCommand({ projectName: 'my app' })).toBe(
    "create-gb-app 'my app'"
  );
});
test('omits default flags', () => {
  expect(formatCommand({ projectName: 'my-gb-app', yes: true })).toBe(
    'create-gb-app my-gb-app'
  );
});
test('prints --preset token and overlay flags only', () => {
  expect(
    formatCommand({
      projectName: 'my-gb-app',
      yes: true,
      preset: 'nest',
      backend: 'nest',
      frontend: 'tanstack-start',
      addons: {
        linting: 'biome',
      },
    })
  ).toBe('create-gb-app my-gb-app --preset nest --frontend tanstack-start');
});
test('keeps the preset token and omits expanded defaults', () => {
  expect(
    formatCommand({
      projectName: 'my-gb-app',
      yes: true,
      preset: 'nest',
      backend: 'nest',
      addons: {
        linting: 'biome',
      },
    })
  ).toBe('create-gb-app my-gb-app --preset nest');
});

test('Convex omits the relational groups it implies', () => {
  expect(
    formatCommand({
      projectName: 'my-gb-app',
      backend: 'convex',
      api: 'none',
      database: 'none',
      orm: 'none',
      dbSetup: 'none',
    })
  ).toBe('create-gb-app my-gb-app --backend convex');
});
