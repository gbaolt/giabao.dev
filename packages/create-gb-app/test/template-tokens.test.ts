import { expect, test } from 'bun:test';

import { GenerateError } from '#/generate/errors';
import { buildTree, type RawFlags, resolveStack } from '#/generate/public';
import { fillTemplate } from '#/generate/template-tokens';

test('fillTemplate replaces every occurrence of each token', () => {
  expect(
    fillTemplate("import { Button } from '__UI__button';\n// __UI__\n", {
      UI: '@repo/ui/',
    })
  ).toBe("import { Button } from '@repo/ui/button';\n// @repo/ui/\n");
});

test('fillTemplate rejects a token without a value', () => {
  expect(() => fillTemplate('title: __PROJECT_NAME__', {})).toThrow(
    'Unknown template token: __PROJECT_NAME__'
  );
});

test('fillTemplate keeps token-shaped text inside substituted values', () => {
  expect(fillTemplate('__A__', { A: '__B__' })).toBe('__B__');
});

test('login generation accepts a token-shaped project name', () => {
  const files = buildTree(resolveStack({ yes: true }), {
    projectName: '__DEMO__',
    packageManager: 'bun',
  });
  expect(files['app/login/page.tsx']).toContain('__DEMO__');
});

const axes = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'convex', 'hono'],
  structure: ['single', 'monorepo'],
  api: ['orpc', 'trpc', 'none'],
  database: ['postgres', 'none'],
  auth: ['better-auth', 'clerk', 'none'],
  form: ['none', 'react-hook-form', 'tanstack-form'],
} as const;

function* stacks(): Generator<RawFlags> {
  const combos: Record<string, string>[] = [{}];
  for (const [axis, values] of Object.entries(axes)) {
    for (const combo of combos.splice(0)) {
      for (const value of values) combos.push({ ...combo, [axis]: value });
    }
  }
  for (const { form, ...flags } of combos) {
    const raw: Record<string, unknown> = { ...flags, addons: { form } };
    if (flags.backend === 'convex') {
      if (flags.api !== 'none' || flags.database !== 'none') continue;
      delete raw.api;
      delete raw.database;
    }
    yield raw as RawFlags;
  }
}

test('no generated file keeps a template token', () => {
  let generated = 0;
  for (const raw of stacks()) {
    let stack;
    try {
      stack = resolveStack(raw);
    } catch {
      continue;
    }
    let files;
    try {
      files = buildTree(stack, {
        projectName: 'token-app',
        packageManager: 'bun',
      });
    } catch (error) {
      if (error instanceof GenerateError) continue;
      throw error;
    }
    generated++;
    for (const [path, source] of Object.entries(files)) {
      expect({ path, token: source.match(/__[A-Z][A-Z0-9_]*__/)?.[0] }).toEqual(
        { path, token: undefined }
      );
    }
  }
  expect(generated).toBeGreaterThan(100);
});
