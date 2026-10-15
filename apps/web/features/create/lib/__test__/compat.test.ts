import { expect, test } from 'bun:test';
import {
  type CreateFlags,
  FLAG_GROUPS,
  type FlagGroup,
} from 'create-gb-app/preset';
import { selectionValue } from 'create-gb-app/preset';

import compat from '../../data/compat.json';
import { buildCommand } from '../command';
import {
  applyFlagChange,
  disabledRuleId,
  isGroupVisible,
  isRelationalGroup,
  normalizeFlags,
  type RuleId,
  YES_DEFAULTS,
} from '../compat';
test('vendored yesDefault is the picker default', () => {
  expect(compat.yesDefault).toEqual(YES_DEFAULTS);
});
test('nest keeps the selected linter', () => {
  const next = applyFlagChange(YES_DEFAULTS, 'backend', 'nest');
  expect(next).toEqual({
    ...YES_DEFAULTS,
    backend: 'nest',
    structure: 'monorepo',
    addons: {
      ...YES_DEFAULTS.addons,
      taskRunner: 'turborepo',
    },
  });
  expect(next.addons.linting).toBe('auto');
  expect(normalizeFlags({ ...YES_DEFAULTS, backend: 'nest' })).toEqual(next);
  expect(disabledRuleId(next, 'linting', 'eslint')).toBeNull();
  expect(disabledRuleId(next, 'linting', 'biome')).toBeNull();
  expect(disabledRuleId(next, 'linting', 'oxlint')).toBeNull();
});
test('hono keeps eslint and leaves tRPC enabled', () => {
  const next = applyFlagChange(YES_DEFAULTS, 'backend', 'hono');
  expect(next).toEqual({
    ...YES_DEFAULTS,
    backend: 'hono',
    structure: 'monorepo',
    addons: {
      ...YES_DEFAULTS.addons,
      taskRunner: 'turborepo',
    },
  });
  expect(disabledRuleId(next, 'api', 'trpc')).toBeNull();
  expect(disabledRuleId(next, 'linting', 'eslint')).toBeNull();
  expect(
    disabledRuleId({ ...YES_DEFAULTS, backend: 'nest' }, 'api', 'trpc')
  ).toBe('nest-trpc');
});
test('required Turborepo stays selected and explains its constraint', () => {
  const nest = applyFlagChange(YES_DEFAULTS, 'backend', 'nest');
  expect(nest.structure).toBe('monorepo');
  expect(disabledRuleId(nest, 'structure', 'single')).toBe(
    'backend-requires-monorepo'
  );
  expect(disabledRuleId(nest, 'structure', 'monorepo')).toBeNull();
  const self = applyFlagChange(nest, 'backend', 'self');
  expect(self.structure).toBe('single');
  expect(disabledRuleId(self, 'structure', 'monorepo')).toBeNull();
});
for (const backend of ['self', 'convex'] as const) {
  test(`${backend} allows both layouts and preserves URL structure`, () => {
    const defaults = applyFlagChange(YES_DEFAULTS, 'backend', backend);
    expect(defaults.structure).toBe('single');
    for (const structure of ['single', 'monorepo'] as const) {
      expect(disabledRuleId(defaults, 'structure', structure)).toBeNull();
      const selected = applyFlagChange(defaults, 'structure', structure);
      expect(normalizeFlags(selected)).toEqual(selected);
    }
  });
}
test('nest plus oxlint stays oxlint', () => {
  const next = applyFlagChange(
    {
      ...YES_DEFAULTS,
      addons: {
        ...YES_DEFAULTS.addons,
        linting: 'oxlint',
      },
    },
    'backend',
    'nest'
  );
  expect(next.addons.linting).toBe('oxlint');
  expect(
    normalizeFlags({
      ...YES_DEFAULTS,
      backend: 'nest',
      addons: {
        ...YES_DEFAULTS.addons,
        linting: 'oxlint',
      },
    })
  ).toEqual(next);
});
for (const legal of compat.legal) {
  test(legal.name, () => {
    const flags = normalizeFlags({
      ...YES_DEFAULTS,
      ...legal.flags,
    } as CreateFlags);
    for (const group of FLAG_GROUPS) {
      if (!(group in legal.stack)) {
        continue;
      }
      if (!isGroupVisible(flags, group)) {
        continue;
      }
      const expected = legal.stack[group as keyof typeof legal.stack];
      if (typeof expected !== 'string') {
        continue;
      }
      expect(selectionValue(flags, group) as string).toBe(expected);
    }
    const command = buildCommand(flags);
    expect(command.startsWith('npx create-gb-app my-gb-app')).toBe(true);
    expect(command).not.toContain('--yes');
    if (Object.keys(legal.flags).length > 0) {
      expect(command).toContain('--preset');
    }
  });
}
for (const illegal of compat.illegal) {
  test(illegal.name, () => {
    const patch = illegal.flags as Partial<CreateFlags>;
    const groups = (Object.keys(patch) as FlagGroup[]).filter(
      (group) => patch[group as keyof typeof patch] !== undefined
    );
    expect(groups.length).toBeGreaterThan(0);
    const hits = groups.map((group) => {
      const value = patch[group as keyof typeof patch];
      if (typeof value !== 'string') {
        return null;
      }
      const probe = {
        ...YES_DEFAULTS,
        ...patch,
        [group]: selectionValue(YES_DEFAULTS, group),
      } as CreateFlags;
      return disabledRuleId(probe, group, value);
    });
    expect(hits).toContain(illegal.ruleId as RuleId);
    const flags = { ...YES_DEFAULTS, ...patch } as CreateFlags;
    if (flags.backend !== 'convex') {
      return;
    }
    for (const group of groups) {
      if (!isRelationalGroup(group)) {
        continue;
      }
      expect(isGroupVisible(flags, group)).toBe(true);
    }
  });
}
