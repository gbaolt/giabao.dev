import { describe, expect, test } from 'bun:test';

import { CompatError, RULE_IDS, type RuleId } from '#/stack/errors';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags, Stack } from '#/types/stack';

import compat from './fixtures/compat.json';
test('--yes default', () => {
  const stack = resolveStack({ yes: true });
  expect(stack).toEqual(compat.yesDefault as Stack);
});
for (const legal of compat.legal) {
  test(legal.name, () => {
    expect(resolveStack(legal.flags as RawFlags)).toEqual(legal.stack as Stack);
  });
}
for (const illegal of compat.illegal) {
  test(illegal.name, () => {
    try {
      resolveStack(illegal.flags as RawFlags);
      throw new Error(`expected CompatError ${illegal.ruleId}`);
    } catch (error) {
      expect(error).toBeInstanceOf(CompatError);
      expect((error as CompatError).ruleId).toBe(illegal.ruleId as RuleId);
    }
  });
}
describe('parse then resolve', () => {
  test('literal --yes stack JSON', () => {
    expect(resolveStack({ yes: true })).toEqual({
      frontend: 'next',
      backend: 'self',
      structure: 'single',
      api: 'orpc',
      database: 'postgres',
      orm: 'prisma',
      dbSetup: 'none',
      auth: 'better-auth',
      payments: 'none',
      addons: {
        toolchain: 'standard',
        taskRunner: 'none',
        linting: 'eslint',
        form: 'none',
      },
    });
  });
});
test('convex with explicit db-setup none', () => {
  const convexHappy = compat.legal.find(
    (row) => row.name === 'convex happy path'
  );
  expect(convexHappy).toBeDefined();
  expect(resolveStack({ backend: 'convex', dbSetup: 'none' })).toEqual(
    convexHappy!.stack as Stack
  );
});
test('structure follows the historical backend layout', () => {
  expect(resolveStack({ backend: 'self' }).structure).toBe('single');
  expect(resolveStack({ backend: 'convex' }).structure).toBe('single');
  expect(resolveStack({ backend: 'nest' }).structure).toBe('monorepo');
  expect(resolveStack({ backend: 'hono' }).structure).toBe('monorepo');
});
test('required structures fail descriptively and optional layouts remain available', () => {
  expect(() => resolveStack({ backend: 'nest', structure: 'single' })).toThrow(
    new CompatError(RULE_IDS.backendRequiresMonorepo)
  );
  expect(() => resolveStack({ backend: 'hono', structure: 'single' })).toThrow(
    new CompatError(RULE_IDS.backendRequiresMonorepo)
  );
  expect(
    resolveStack({
      backend: 'self',
      structure: 'monorepo',
      addons: {
        taskRunner: 'turborepo',
      },
    }).structure
  ).toBe('monorepo');
  expect(
    resolveStack({
      backend: 'convex',
      structure: 'monorepo',
      addons: {
        taskRunner: 'turborepo',
      },
    }).structure
  ).toBe('monorepo');
});
test('CompatError ruleId is not writable', () => {
  const error = new CompatError('clerk-polar-forbidden');
  expect(Object.getOwnPropertyDescriptor(error, 'ruleId')?.writable).toBe(
    false
  );
});
