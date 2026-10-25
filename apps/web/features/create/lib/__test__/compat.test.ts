import { expect, test } from 'bun:test';
import {
  applyChange,
  type CreateFlags,
  FLAG_GROUPS,
  type FlagGroup,
  optionState,
  parseChoice,
  repairConfiguration,
  RULE_MESSAGES,
  type RuleId,
  selectionValue,
  VOCAB_BY_GROUP,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

import compat from '../../../../../../packages/create-gb-app/test/fixtures/compat.json';
import { buildCommand } from '../command';

function disabledRuleId(
  flags: CreateFlags,
  group: FlagGroup,
  value: string
): RuleId | null {
  const state = optionState(
    flags,
    group,
    parseChoice(group, value, VOCAB_BY_GROUP[group])
  );
  return state.enabled ? null : state.ruleId;
}

function fixtureConfiguration(flags: Record<string, unknown>): CreateFlags {
  const { addons, ...core } = flags as Partial<CreateFlags>;
  return {
    ...YES_DEFAULTS,
    ...core,
    addons: { ...YES_DEFAULTS.addons, ...addons },
  };
}

test('nest keeps the selected linter', () => {
  const next = applyChange(YES_DEFAULTS, 'backend', 'nest');
  expect(next).toEqual({
    ...YES_DEFAULTS,
    backend: 'nest',
    structure: 'monorepo',
  });
  expect(repairConfiguration({ ...YES_DEFAULTS, backend: 'nest' })).toEqual(
    next
  );
  for (const linting of ['eslint', 'biome', 'oxlint'])
    expect(disabledRuleId(next, 'linting', linting)).toBeNull();
});
test('hono leaves tRPC enabled while Nest disables it', () => {
  const next = applyChange(YES_DEFAULTS, 'backend', 'hono');
  expect(next.structure).toBe('monorepo');
  expect(disabledRuleId(next, 'api', 'trpc')).toBeNull();
  expect(
    disabledRuleId(applyChange(YES_DEFAULTS, 'backend', 'nest'), 'api', 'trpc')
  ).toBe('nest-trpc');
});
test('disabled options show the CLI rule message', () => {
  expect(optionState(YES_DEFAULTS, 'linting', 'biome')).toEqual({
    enabled: false,
    ruleId: 'biome-requires-nest-or-hono',
    message: RULE_MESSAGES['biome-requires-nest-or-hono'],
  });
});
test('required monorepo stays selected and explains its constraint', () => {
  const nest = applyChange(YES_DEFAULTS, 'backend', 'nest');
  expect(disabledRuleId(nest, 'structure', 'single')).toBe(
    'backend-requires-monorepo'
  );
  expect(disabledRuleId(nest, 'structure', 'monorepo')).toBeNull();
  const self = applyChange(nest, 'backend', 'self');
  expect(self.structure).toBe('single');
  expect(disabledRuleId(self, 'structure', 'monorepo')).toBeNull();
});
for (const backend of ['self', 'convex'] as const) {
  test(`${backend} allows both layouts and preserves URL structure`, () => {
    const defaults = applyChange(YES_DEFAULTS, 'backend', backend);
    expect(defaults.structure).toBe('single');
    for (const structure of ['single', 'monorepo'] as const) {
      expect(disabledRuleId(defaults, 'structure', structure)).toBeNull();
      const selected = applyChange(defaults, 'structure', structure);
      expect(repairConfiguration(selected)).toEqual(selected);
    }
  });
}
test('nest plus oxlint stays oxlint', () => {
  const oxlint = {
    ...YES_DEFAULTS,
    addons: { ...YES_DEFAULTS.addons, linting: 'oxlint' as const },
  };
  expect(applyChange(oxlint, 'backend', 'nest').addons.linting).toBe('oxlint');
});
for (const legal of compat.legal) {
  test(legal.name, () => {
    const flags = repairConfiguration(fixtureConfiguration(legal.flags));
    for (const group of FLAG_GROUPS) {
      const expected = legal.stack[group as keyof typeof legal.stack];
      if (typeof expected !== 'string') continue;
      expect(selectionValue(flags, group) as string).toBe(expected);
    }
    const command = buildCommand(flags);
    expect(command.startsWith('npx create-gb-app my-gb-app')).toBe(true);
    expect(command).not.toContain('--yes');
    expect(command).toContain('--preset');
  });
}
for (const illegal of compat.illegal) {
  test(`${illegal.name} is not selectable`, () => {
    const flags = fixtureConfiguration(illegal.flags);
    const groups = FLAG_GROUPS.filter(
      (group) =>
        group in illegal.flags ||
        group in ((illegal.flags as { addons?: object }).addons ?? {})
    );
    expect(
      groups.map((group) =>
        disabledRuleId(flags, group, selectionValue(flags, group))
      )
    ).toContain(illegal.ruleId as RuleId);
  });
}
