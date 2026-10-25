import { expect, test } from 'bun:test';

import {
  parseArgs,
  ParseError,
  shouldGenerateHeadless,
  USAGE,
} from '#/cli/parse-args';
import { resolveStack } from '#/stack/resolve';
test('single directory positional', () => {
  expect(parseArgs(['my-gb-app', '--yes'])).toEqual({
    projectName: 'my-gb-app',
    yes: true,
  });
});
test('extra positionals are rejected', () => {
  expect(() => parseArgs(['my-gb-app', 'extra', '--yes'])).toThrow(ParseError);
  try {
    parseArgs(['my-gb-app', 'extra']);
    throw new Error('expected ParseError');
  } catch (error) {
    expect(error).toBeInstanceOf(ParseError);
    expect((error as ParseError).message).toContain('extra');
  }
});
test('--preset nest expands to a generatable overlay', () => {
  const raw = parseArgs(['my-gb-app', '--yes', '--preset', 'nest']);
  expect(raw.preset).toBe('nest');
  expect(raw.backend).toBe('nest');
  expect(raw.addons?.linting).toBe('biome');
  expect(raw.api).toBe('orpc');
  expect(raw.database).toBe('postgres');
  expect(raw.orm).toBe('prisma');
  expect(raw.dbSetup).toBe('none');
  expect(raw.yes).toBe(true);
  expect(raw.projectName).toBe('my-gb-app');
});
test('explicit flags overlay the preset', () => {
  const raw = parseArgs(['--preset', 'gb2', '--frontend', 'tanstack-start']);
  expect(raw.frontend).toBe('tanstack-start');
  expect(raw.preset).toBe('gb2');
  expect(raw.backend).toBe('nest');
});
test('explicit flags overlay versioned preset selections', () => {
  const raw = parseArgs([
    '--preset',
    'gb-v1-48',
    '--frontend',
    'tanstack-start',
  ]);
  expect(raw.backend).toBe('nest');
  expect(raw.frontend).toBe('tanstack-start');
  expect(raw.preset).toBe('gb-v1-48');
});
test('structure flag is parsed and required backends reject single app', () => {
  const raw = parseArgs(['--preset', 'gb-v1-48', '--structure', 'single']);
  expect(raw.structure).toBe('single');
  expect(raw.backend).toBe('nest');
  expect(() => resolveStack(raw)).toThrow('Nest and Hono require a monorepo');
  expect(() => parseArgs(['--structure', 'workspace'])).toThrow(ParseError);
});
test('explicit backend override reconciles a preset structure', () => {
  const raw = parseArgs([
    '--preset',
    'nest',
    '--backend',
    'self',
    '--linting',
    'eslint',
  ]);
  expect(raw.backend).toBe('self');
  expect(raw.structure).toBe('single');
  expect(resolveStack(raw).structure).toBe('single');
  const explicitStructure = parseArgs([
    '--preset',
    'nest',
    '--backend',
    'self',
    '--structure',
    'turborepo',
  ]);
  expect(explicitStructure.structure).toBe('monorepo');
});
test('unknown --preset fails closed', () => {
  expect(() => parseArgs(['--preset', 'nope'])).toThrow(ParseError);
});
test('copied preset command keeps directory and token without --yes', () => {
  const raw = parseArgs(['my-gb-app', '--preset', 'gb2']);
  expect(raw.projectName).toBe('my-gb-app');
  expect(raw.preset).toBe('gb2');
  expect(raw.yes).toBeUndefined();
  expect(raw.backend).toBe('nest');
});
test('USAGE Flags list still includes --preset', () => {
  const flagsBlock = USAGE.split('Flags')[1];
  expect(flagsBlock).toContain('--preset');
});
test('shouldGenerateHeadless is true for preset, directory, yes, or non-TTY', () => {
  expect(
    shouldGenerateHeadless(parseArgs(['my-gb-app', '--preset', 'gb2']), true)
  ).toBe(true);
  expect(shouldGenerateHeadless(parseArgs(['my-gb-app']), true)).toBe(true);
  expect(shouldGenerateHeadless(parseArgs(['--yes']), true)).toBe(true);
  expect(shouldGenerateHeadless({}, true)).toBe(false);
  expect(shouldGenerateHeadless({}, false)).toBe(true);
});

test('every stack group parses from its vocabulary flag', () => {
  expect(
    parseArgs([
      '--db-setup',
      'neon',
      '--task-runner=turborepo',
      '--form',
      'tanstack-form',
      '--auth',
      'clerk',
    ])
  ).toEqual({
    dbSetup: 'neon',
    auth: 'clerk',
    addons: { taskRunner: 'turborepo', form: 'tanstack-form' },
  });
  expect(() => parseArgs(['--db-setup', 'mongo'])).toThrow(ParseError);
  expect(() => parseArgs(['--db_setup', 'neon'])).toThrow('unknown flag');
});
