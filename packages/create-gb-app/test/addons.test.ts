import { expect, test } from 'bun:test';

import { parseArgs } from '#/cli/parse-args';
import {
  decodePreset,
  encodePreset,
  resolveStack,
  YES_DEFAULTS,
} from '#/generate/public';
import {
  configurationFromQuery,
  configurationQuery,
  overlayRawFlags,
} from '#/preset';

test('historical Nest presets retain explicit Turbo and lint selections', () => {
  const saved = decodePreset('gb2');
  expect(saved.structure).toBe('monorepo');
  expect(saved).toHaveProperty('addons', {
    toolchain: 'standard',
    taskRunner: 'turborepo',
    linting: 'eslint',
    form: 'none',
  });
  expect(saved).not.toHaveProperty('linter');
});

test('new preset codes version the nested addon selections', () => {
  const code = encodePreset(YES_DEFAULTS);
  expect(code).toStartWith('gb-v2-');
  expect(decodePreset(code)).toEqual(YES_DEFAULTS);
});

test('explicit nested addon values override legacy aliases', () => {
  const stack = resolveStack({
    linter: 'oxlint',
    form: 'react-hook-form',
    addons: { linting: 'eslint', form: 'none' },
  });
  expect(stack).toHaveProperty('addons.linting', 'eslint');
  expect(stack).toHaveProperty('addons.form', 'none');
});

test('a form override preserves sibling addon selections and explicit none', () => {
  const raw = overlayRawFlags(
    {
      addons: {
        taskRunner: 'turborepo',
        linting: 'oxlint',
        form: 'react-hook-form',
      },
    },
    { addons: { form: 'none' } }
  );
  expect(raw.addons).toEqual({
    taskRunner: 'turborepo',
    linting: 'oxlint',
    form: 'none',
  });
});

test('CLI canonical flags win aliases in either order', () => {
  for (const argv of [
    ['--linter', 'oxlint', '--linting', 'eslint'],
    ['--linting', 'eslint', '--linter', 'oxlint'],
  ]) {
    expect(parseArgs(argv).addons?.linting).toBe('eslint');
  }
  const raw = parseArgs(['--structure', 'turborepo', '--task-runner', 'none']);
  expect(raw.structure).toBe('monorepo');
  expect(raw.addons?.taskRunner).toBe('none');
});

test('old Create links retain Turbo while v2 links preserve auto selections', () => {
  for (const backend of ['nest', 'hono']) {
    const imported = configurationFromQuery({ backend });
    expect(imported.structure).toBe('monorepo');
    expect(imported.addons.taskRunner).toBe('turborepo');
    expect(imported.addons.linting).toBe('eslint');
    expect(configurationFromQuery(configurationQuery(imported))).toEqual(
      imported
    );
  }
  expect(configurationFromQuery(configurationQuery(YES_DEFAULTS))).toEqual(
    YES_DEFAULTS
  );
  expect(configurationQuery(YES_DEFAULTS).schema).toBe('2');
});
