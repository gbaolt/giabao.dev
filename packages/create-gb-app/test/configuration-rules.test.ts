import { describe, expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { GenerateError } from '#/generate/errors';
import {
  applyChange,
  CompatError,
  FLAG_GROUPS,
  type FlagGroup,
  optionState,
  type PresetFields,
  resolveStack,
  RULE_IDS,
  RULE_MESSAGES,
  type RuleId,
  type SelectionValues,
  VOCAB_BY_GROUP,
  withSelection,
  YES_DEFAULTS,
} from '#/preset';

function configuration(
  overrides: Partial<Omit<PresetFields, 'addons'>> = {},
  addons: Partial<PresetFields['addons']> = {}
): PresetFields {
  return {
    ...YES_DEFAULTS,
    ...overrides,
    addons: { ...YES_DEFAULTS.addons, ...addons },
  };
}

function compatRule(configuration: PresetFields): RuleId | null {
  try {
    resolveStack(configuration);
    return null;
  } catch (error) {
    if (error instanceof CompatError) return error.ruleId;
    throw error;
  }
}

const CONVEX = configuration({
  backend: 'convex',
  api: 'none',
  database: 'none',
  orm: 'none',
});
const NO_DATABASE = configuration({
  database: 'none',
  orm: 'none',
  auth: 'none',
});

// One valid Configuration per rule, and the change that conflicts with it.
const CASES: Array<{
  ruleId: RuleId;
  base: PresetFields;
  group: FlagGroup;
  value: SelectionValues[FlagGroup];
}> = [
  {
    ruleId: 'backend-requires-monorepo',
    base: configuration({ backend: 'nest', structure: 'monorepo' }),
    group: 'structure',
    value: 'single',
  },
  {
    ruleId: 'turbo-requires-monorepo',
    base: configuration(),
    group: 'taskRunner',
    value: 'turborepo',
  },
  {
    ruleId: 'convex-database-off',
    base: CONVEX,
    group: 'database',
    value: 'postgres',
  },
  { ruleId: 'convex-api-off', base: CONVEX, group: 'api', value: 'orpc' },
  { ruleId: 'convex-orm-off', base: CONVEX, group: 'orm', value: 'prisma' },
  {
    ruleId: 'convex-db-setup-off',
    base: CONVEX,
    group: 'dbSetup',
    value: 'docker',
  },
  {
    ruleId: 'clerk-polar-forbidden',
    base: configuration({ auth: 'clerk' }),
    group: 'payments',
    value: 'polar',
  },
  {
    ruleId: 'polar-requires-better-auth',
    base: configuration({ auth: 'none' }),
    group: 'payments',
    value: 'polar',
  },
  {
    ruleId: 'payments-require-auth',
    base: configuration({ auth: 'none' }),
    group: 'payments',
    value: 'stripe',
  },
  {
    ruleId: 'orm-requires-database',
    base: NO_DATABASE,
    group: 'orm',
    value: 'prisma',
  },
  {
    ruleId: 'database-requires-orm',
    base: configuration(),
    group: 'orm',
    value: 'none',
  },
  {
    ruleId: 'db-setup-requires-database',
    base: NO_DATABASE,
    group: 'dbSetup',
    value: 'docker',
  },
  {
    ruleId: 'sqlite-docker-forbidden',
    base: configuration({ database: 'sqlite' }),
    group: 'dbSetup',
    value: 'docker',
  },
  {
    ruleId: 'neon-requires-postgres',
    base: configuration({ database: 'mysql' }),
    group: 'dbSetup',
    value: 'neon',
  },
  {
    ruleId: 'supabase-requires-postgres',
    base: configuration({ database: 'mysql' }),
    group: 'dbSetup',
    value: 'supabase',
  },
  {
    ruleId: 'turso-requires-sqlite',
    base: configuration(),
    group: 'dbSetup',
    value: 'turso',
  },
  {
    ruleId: 'planetscale-requires-postgres-or-mysql',
    base: configuration({ database: 'sqlite' }),
    group: 'dbSetup',
    value: 'planetscale',
  },
  {
    ruleId: 'prisma-postgres-requires-postgres',
    base: configuration({ database: 'mysql' }),
    group: 'dbSetup',
    value: 'prisma-postgres',
  },
  {
    ruleId: 'better-auth-requires-database',
    base: NO_DATABASE,
    group: 'auth',
    value: 'better-auth',
  },
  {
    ruleId: 'nest-trpc',
    base: configuration({ backend: 'nest', structure: 'monorepo' }),
    group: 'api',
    value: 'trpc',
  },
  {
    ruleId: 'biome-requires-nest-or-hono',
    base: configuration(),
    group: 'linting',
    value: 'biome',
  },
  {
    ruleId: 'start-orpc-limits',
    base: configuration({ frontend: 'tanstack-start' }),
    group: 'database',
    value: 'sqlite',
  },
];

test('every rule has a case', () => {
  expect(new Set(CASES.map((row) => row.ruleId))).toEqual(
    new Set(Object.values(RULE_IDS))
  );
});

describe.each(CASES)('$ruleId', ({ ruleId, base, group, value }) => {
  test('the base Configuration resolves', () => {
    expect(compatRule(base)).toBeNull();
  });
  test('optionState disables the conflicting value with the rule', () => {
    expect(optionState(base, group, value)).toEqual({
      enabled: false,
      ruleId,
      message: RULE_MESSAGES[ruleId],
    });
  });
  test('resolveStack throws the same rule', () => {
    expect(compatRule(withSelection(base, group, value))).toBe(ruleId);
  });
  test('applyChange repairs to a Configuration that resolves', () => {
    expect(compatRule(applyChange(base, group, value))).toBeNull();
  });
});

test('optionState enables a compatible value', () => {
  expect(optionState(YES_DEFAULTS, 'database', 'sqlite')).toEqual({
    enabled: true,
  });
});

test('turning off the database turns off its dependents', () => {
  expect(applyChange(YES_DEFAULTS, 'database', 'none')).toEqual(
    configuration({
      database: 'none',
      orm: 'none',
      dbSetup: 'none',
      auth: 'none',
    })
  );
});

test('Convex turns the relational groups off', () => {
  expect(
    applyChange(configuration({ api: 'trpc' }), 'backend', 'convex')
  ).toEqual(CONVEX);
});

test('Nest moves to a monorepo and leaves tRPC', () => {
  expect(
    applyChange(configuration({ api: 'trpc' }), 'backend', 'nest')
  ).toEqual(configuration({ backend: 'nest', structure: 'monorepo' }));
});

test('a single app falls back to the automatic task runner', () => {
  const monorepo = configuration(
    { structure: 'monorepo' },
    { taskRunner: 'turborepo' }
  );
  expect(applyChange(monorepo, 'structure', 'single')).toEqual(configuration());
});

test('Start with built-in oRPC repairs the database to Postgres', () => {
  expect(
    applyChange(
      configuration({ database: 'sqlite' }),
      'frontend',
      'tanstack-start'
    )
  ).toEqual(configuration({ frontend: 'tanstack-start' }));
});

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

test('every reachable change resolves and generates without a gap', () => {
  const random = seededRandom(7);
  const generated = new Set<string>();
  let current: PresetFields = YES_DEFAULTS;
  for (let step = 0; step < 4000; step++) {
    const group = FLAG_GROUPS[Math.floor(random() * FLAG_GROUPS.length)];
    const values = VOCAB_BY_GROUP[group];
    const value = values[Math.floor(random() * values.length)];
    current = applyChange(current, group, value);
    const stack = resolveStack(current);
    const key = JSON.stringify(stack);
    if (generated.has(key)) continue;
    generated.add(key);
    try {
      buildTree(stack, { projectName: 'rules', packageManager: 'bun' });
    } catch (error) {
      if (error instanceof GenerateError)
        throw new Error(`${error.code} reached for ${key}`);
      throw error;
    }
  }
  expect(generated.size).toBeGreaterThan(200);
});

test('no resolved Stack on the gap axes throws GenerateError', () => {
  const axes = {
    frontend: ['next', 'tanstack-start'],
    backend: ['self', 'nest', 'convex', 'hono'],
    structure: ['single', 'monorepo'],
    api: ['orpc', 'trpc', 'none'],
    database: ['postgres', 'sqlite', 'none'],
    orm: ['prisma', 'none'],
    dbSetup: ['none', 'docker'],
    auth: ['better-auth', 'clerk', 'none'],
    payments: ['none', 'stripe'],
    form: ['none', 'react-hook-form'],
    linting: ['eslint', 'biome'],
  } as const;
  const keys = Object.keys(axes) as (keyof typeof axes)[];
  let resolved = 0;
  const walk = (index: number, picked: Record<string, string>): void => {
    if (index === keys.length) {
      const { form, linting, ...core } = picked;
      const raw = { ...core, addons: { form, linting } };
      let stack;
      try {
        stack = resolveStack(raw as never);
      } catch (error) {
        if (error instanceof CompatError) return;
        throw error;
      }
      resolved++;
      try {
        buildTree(stack, { projectName: 'gaps', packageManager: 'bun' });
      } catch (error) {
        if (error instanceof GenerateError)
          throw new Error(`${error.code} reached for ${JSON.stringify(raw)}`);
        throw error;
      }
      return;
    }
    const key = keys[index];
    for (const value of axes[key]) walk(index + 1, { ...picked, [key]: value });
  };
  walk(0, {});
  expect(resolved).toBeGreaterThan(500);
});
