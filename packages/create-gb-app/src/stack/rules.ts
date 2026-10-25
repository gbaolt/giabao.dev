import type {
  PresetFields,
  ProjectStructure,
  SelectionValues,
} from '#/types/stack';

import { withSelection } from './configuration';
import { RULE_IDS, RULE_MESSAGES, type RuleId } from './errors';
import type { FlagGroup } from './vocab';

type Rule = {
  id: RuleId;
  // optionState disables conflicting values only in these groups; changes to
  // any other group are repaired instead.
  groups: readonly FlagGroup[];
  violates: (configuration: PresetFields) => boolean;
  repair: (configuration: PresetFields) => PresetFields;
};

export type OptionState =
  { enabled: true } | { enabled: false; ruleId: RuleId; message: string };

function set<K extends FlagGroup>(key: K, value: SelectionValues[K]) {
  return (configuration: PresetFields) =>
    withSelection(configuration, key, value);
}

function dbSetupRule(
  id: RuleId,
  violates: (configuration: PresetFields) => boolean
): Rule {
  return {
    id,
    groups: ['database', 'dbSetup'],
    violates,
    repair: set('dbSetup', 'none'),
  };
}

function hasServer(configuration: PresetFields): boolean {
  return configuration.backend === 'nest' || configuration.backend === 'hono';
}

function usesStartOrpc(configuration: PresetFields): boolean {
  return (
    configuration.backend === 'self' &&
    configuration.frontend === 'tanstack-start' &&
    configuration.api === 'orpc'
  );
}

// Order decides which rule resolveStack reports first.
export const RULES: readonly Rule[] = [
  {
    id: RULE_IDS.backendRequiresMonorepo,
    groups: ['structure'],
    violates: (c) => hasServer(c) && c.structure !== 'monorepo',
    repair: set('structure', 'monorepo'),
  },
  {
    id: RULE_IDS.turboRequiresMonorepo,
    groups: ['taskRunner'],
    violates: (c) =>
      c.structure === 'single' && c.addons.taskRunner === 'turborepo',
    repair: set('taskRunner', 'auto'),
  },
  {
    id: RULE_IDS.convexDatabaseOff,
    groups: ['database'],
    violates: (c) => c.backend === 'convex' && c.database !== 'none',
    repair: set('database', 'none'),
  },
  {
    id: RULE_IDS.convexApiOff,
    groups: ['api'],
    violates: (c) => c.backend === 'convex' && c.api !== 'none',
    repair: set('api', 'none'),
  },
  {
    id: RULE_IDS.convexOrmOff,
    groups: ['orm'],
    violates: (c) => c.backend === 'convex' && c.orm !== 'none',
    repair: set('orm', 'none'),
  },
  {
    id: RULE_IDS.convexDbSetupOff,
    groups: ['dbSetup'],
    violates: (c) => c.backend === 'convex' && c.dbSetup !== 'none',
    repair: set('dbSetup', 'none'),
  },
  {
    id: RULE_IDS.clerkPolarForbidden,
    groups: ['auth', 'payments'],
    violates: (c) => c.auth === 'clerk' && c.payments === 'polar',
    repair: set('payments', 'none'),
  },
  {
    id: RULE_IDS.polarRequiresBetterAuth,
    groups: ['auth', 'payments'],
    violates: (c) => c.payments === 'polar' && c.auth !== 'better-auth',
    repair: set('payments', 'none'),
  },
  {
    id: RULE_IDS.paymentsRequireAuth,
    groups: ['auth', 'payments'],
    violates: (c) => c.payments !== 'none' && c.auth === 'none',
    repair: set('payments', 'none'),
  },
  {
    id: RULE_IDS.ormRequiresDatabase,
    groups: ['orm'],
    violates: (c) => c.database === 'none' && c.orm !== 'none',
    repair: set('orm', 'none'),
  },
  {
    id: RULE_IDS.databaseRequiresOrm,
    groups: ['orm'],
    violates: (c) => c.database !== 'none' && c.orm === 'none',
    repair: set('orm', 'prisma'),
  },
  {
    id: RULE_IDS.dbSetupRequiresDatabase,
    groups: ['dbSetup'],
    violates: (c) => c.database === 'none' && c.dbSetup !== 'none',
    repair: set('dbSetup', 'none'),
  },
  dbSetupRule(
    RULE_IDS.sqliteDockerForbidden,
    (c) => c.database === 'sqlite' && c.dbSetup === 'docker'
  ),
  dbSetupRule(
    RULE_IDS.neonRequiresPostgres,
    (c) => c.dbSetup === 'neon' && c.database !== 'postgres'
  ),
  dbSetupRule(
    RULE_IDS.supabaseRequiresPostgres,
    (c) => c.dbSetup === 'supabase' && c.database !== 'postgres'
  ),
  dbSetupRule(
    RULE_IDS.tursoRequiresSqlite,
    (c) => c.dbSetup === 'turso' && c.database !== 'sqlite'
  ),
  dbSetupRule(
    RULE_IDS.planetscaleRequiresSql,
    (c) =>
      c.dbSetup === 'planetscale' &&
      c.database !== 'postgres' &&
      c.database !== 'mysql'
  ),
  dbSetupRule(
    RULE_IDS.prismaPostgresRequiresPostgres,
    (c) => c.dbSetup === 'prisma-postgres' && c.database !== 'postgres'
  ),
  {
    id: RULE_IDS.betterAuthRequiresDatabase,
    groups: ['auth'],
    violates: (c) =>
      c.backend !== 'convex' &&
      c.auth === 'better-auth' &&
      c.database === 'none',
    repair: set('auth', 'none'),
  },
  // Generator gaps: Configurations buildTree cannot produce yet.
  {
    id: RULE_IDS.nestTrpc,
    groups: ['api'],
    violates: (c) => c.backend === 'nest' && c.api === 'trpc',
    repair: set('api', 'orpc'),
  },
  {
    id: RULE_IDS.biomeRequiresNestOrHono,
    groups: ['linting'],
    violates: (c) => c.addons.linting === 'biome' && !hasServer(c),
    repair: set('linting', 'auto'),
  },
  {
    id: RULE_IDS.startOrpcLimits,
    groups: ['database', 'dbSetup', 'payments', 'auth', 'form'],
    violates: (c) =>
      usesStartOrpc(c) &&
      (c.database !== 'postgres' ||
        c.dbSetup !== 'none' ||
        c.payments !== 'none' ||
        c.auth === 'clerk' ||
        (c.structure === 'monorepo' && c.addons.form !== 'none')),
    repair: (c) => ({
      ...c,
      database: 'postgres',
      dbSetup: 'none',
      payments: 'none',
      auth: c.auth === 'clerk' ? 'better-auth' : c.auth,
      addons: {
        ...c.addons,
        form: c.structure === 'monorepo' ? 'none' : c.addons.form,
      },
    }),
  },
];

export function violatedRule(configuration: PresetFields): RuleId | null {
  return RULES.find((rule) => rule.violates(configuration))?.id ?? null;
}

export function optionState<K extends FlagGroup>(
  configuration: PresetFields,
  group: K,
  value: SelectionValues[K]
): OptionState {
  const next = withSelection(configuration, group, value);
  const rule = RULES.find(
    (candidate) => candidate.groups.includes(group) && candidate.violates(next)
  );
  return rule
    ? { enabled: false, ruleId: rule.id, message: RULE_MESSAGES[rule.id] }
    : { enabled: true };
}

export function repairConfiguration(configuration: PresetFields): PresetFields {
  let next = configuration;
  for (let attempt = 0; attempt <= RULES.length; attempt++) {
    const rule = RULES.find((candidate) => candidate.violates(next));
    if (!rule) return next;
    next = rule.repair(next);
  }
  throw new Error(
    `Configuration repair did not converge: ${JSON.stringify(configuration)}`
  );
}

export function defaultStructureForBackend(
  backend: PresetFields['backend']
): ProjectStructure {
  return backend === 'nest' || backend === 'hono' ? 'monorepo' : 'single';
}

export function applyChange<K extends FlagGroup>(
  configuration: PresetFields,
  group: K,
  value: SelectionValues[K]
): PresetFields {
  let next = withSelection(configuration, group, value);
  if (group === 'backend')
    next = { ...next, structure: defaultStructureForBackend(next.backend) };
  if (
    (group === 'backend' || group === 'structure') &&
    next.structure === 'single'
  )
    next = withSelection(next, 'taskRunner', 'auto');
  return repairConfiguration(next);
}
