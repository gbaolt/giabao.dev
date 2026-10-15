import {
  type Auth,
  type Backend,
  type CreateFlags,
  type Database,
  databaseSetupRule,
  type DbSetup,
  FLAG_GROUPS,
  type FlagGroup,
  isAddonGroup,
  type Payments,
  selectionValue,
  type SelectionValues,
  VOCAB_BY_GROUP,
  withSelection,
  YES_DEFAULTS,
} from 'create-gb-app/preset';

export { YES_DEFAULTS };

export const RULE_IDS = {
  backendRequiresMonorepo: 'backend-requires-monorepo',
  turboRequiresMonorepo: 'turbo-requires-monorepo',
  optionalTurborepoUnavailable: 'optional-turborepo-unavailable',
  nestTrpc: 'nest-trpc',
  polarRequiresBetterAuth: 'polar-requires-better-auth',
  paymentsRequireAuth: 'payments-require-auth',
  convexDatabaseOff: 'convex-database-off',
  convexApiOff: 'convex-api-off',
  convexOrmOff: 'convex-orm-off',
  convexDbSetupOff: 'convex-db-setup-off',
  sqliteDockerForbidden: 'sqlite-docker-forbidden',
  neonRequiresPostgres: 'neon-requires-postgres',
  supabaseRequiresPostgres: 'supabase-requires-postgres',
  tursoRequiresSqlite: 'turso-requires-sqlite',
  planetscaleRequiresSql: 'planetscale-requires-postgres-or-mysql',
  prismaPostgresRequiresPostgres: 'prisma-postgres-requires-postgres',
  clerkPolarForbidden: 'clerk-polar-forbidden',
  betterAuthRequiresDatabase: 'better-auth-requires-database',
  databaseRequiresOrm: 'database-requires-orm',
  ormRequiresDatabase: 'orm-requires-database',
  dbSetupRequiresDatabase: 'db-setup-requires-database',
} as const;

export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS];

export const RULE_MESSAGES: Record<RuleId, string> = {
  'backend-requires-monorepo': 'Nest and Hono require a monorepo',
  'turbo-requires-monorepo': 'Choose a monorepo to use Turborepo',
  'optional-turborepo-unavailable':
    'Turborepo for this backend is not available yet',
  'nest-trpc': 'Nest tRPC generate is not implemented yet',
  'polar-requires-better-auth': 'Polar requires Better Auth',
  'payments-require-auth': 'Payments require auth',
  'convex-database-off': 'Convex provides its own database',
  'convex-api-off': 'Convex cannot use an API layer',
  'convex-orm-off': 'Convex cannot use an ORM',
  'convex-db-setup-off': 'Convex rolls its own database setup',
  'sqlite-docker-forbidden': 'SQLite cannot use docker',
  'neon-requires-postgres': 'Neon requires Postgres',
  'supabase-requires-postgres': 'Supabase requires Postgres',
  'turso-requires-sqlite': 'Turso requires SQLite',
  'planetscale-requires-postgres-or-mysql':
    'PlanetScale requires Postgres or MySQL',
  'prisma-postgres-requires-postgres': 'Prisma Postgres requires Postgres',
  'clerk-polar-forbidden': 'Clerk cannot be used with Polar',
  'better-auth-requires-database': 'Better Auth requires a database',
  'database-requires-orm': 'A database requires an ORM',
  'orm-requires-database': 'An ORM requires a database',
  'db-setup-requires-database': 'Database setup requires a database',
};

const RELATIONAL_GROUPS = new Set<FlagGroup>([
  'api',
  'database',
  'orm',
  'dbSetup',
]);

export function isRelationalGroup(group: FlagGroup): boolean {
  return RELATIONAL_GROUPS.has(group);
}

export function isGroupVisible(flags: CreateFlags, group: FlagGroup): boolean {
  return isAddonGroup(group) || Object.hasOwn(flags, group);
}

export function disabledRuleId(
  flags: CreateFlags,
  group: FlagGroup,
  value: string
): RuleId | null {
  return disabledRule(flags, group, value);
}

export function isOptionEnabled(
  flags: CreateFlags,
  group: FlagGroup,
  value: string
): boolean {
  return disabledRule(flags, group, value) === null;
}

export function disabledReason(
  flags: CreateFlags,
  group: FlagGroup,
  value: string
): string | null {
  const ruleId = disabledRule(flags, group, value);
  return ruleId ? RULE_MESSAGES[ruleId] : null;
}

function convexRelationalRule(group: FlagGroup): RuleId | null {
  switch (group) {
    case 'api':
      return RULE_IDS.convexApiOff;
    case 'database':
      return RULE_IDS.convexDatabaseOff;
    case 'orm':
      return RULE_IDS.convexOrmOff;
    case 'dbSetup':
      return RULE_IDS.convexDbSetupOff;
    case 'frontend':
    case 'backend':
    case 'structure':
    case 'auth':
    case 'payments':
    case 'linting':
    case 'taskRunner':
    case 'toolchain':
    case 'form':
      return null;
    default: {
      const _exhaustive: never = group;
      throw new Error(`unhandled flag group: ${_exhaustive}`);
    }
  }
}

function disabledRule(
  flags: CreateFlags,
  group: FlagGroup,
  value: string
): RuleId | null {
  if (
    group === 'taskRunner' &&
    value === 'turborepo' &&
    flags.structure === 'single'
  )
    return RULE_IDS.turboRequiresMonorepo;
  if (group === 'structure') {
    if (
      (flags.backend === 'nest' || flags.backend === 'hono') &&
      value === 'single'
    ) {
      return RULE_IDS.backendRequiresMonorepo;
    }
  }
  if (flags.backend === 'convex' && value !== 'none') {
    const convexRule = convexRelationalRule(group);
    if (convexRule) {
      return convexRule;
    }
  }

  if (group === 'api' && flags.backend === 'nest' && value === 'trpc') {
    return RULE_IDS.nestTrpc;
  }

  if (
    group === 'orm' &&
    flags.backend !== 'convex' &&
    flags.database !== 'none' &&
    value === 'none'
  ) {
    return RULE_IDS.databaseRequiresOrm;
  }

  if (
    group === 'orm' &&
    flags.backend !== 'convex' &&
    flags.database === 'none' &&
    value !== 'none'
  ) {
    return RULE_IDS.ormRequiresDatabase;
  }

  if (
    group === 'auth' &&
    value === 'better-auth' &&
    flags.backend !== 'convex' &&
    flags.database === 'none'
  ) {
    return RULE_IDS.betterAuthRequiresDatabase;
  }

  if (group === 'dbSetup') return databaseSetupRule(flags.database, value);
  if (group === 'database' && value !== 'none') {
    const rule = databaseSetupRule(value, flags.dbSetup);
    if (rule) return rule;
  }

  if (group === 'payments') {
    if (value === 'polar' && flags.auth === 'clerk') {
      return RULE_IDS.clerkPolarForbidden;
    }
    if (value === 'polar' && flags.auth !== 'better-auth') {
      return RULE_IDS.polarRequiresBetterAuth;
    }
    if (value !== 'none' && flags.auth === 'none') {
      return RULE_IDS.paymentsRequireAuth;
    }
  }

  if (group === 'auth') {
    if (value === 'clerk' && flags.payments === 'polar') {
      return RULE_IDS.clerkPolarForbidden;
    }
    if (value !== 'better-auth' && flags.payments === 'polar') {
      return RULE_IDS.polarRequiresBetterAuth;
    }
    if (value === 'none' && flags.payments !== 'none') {
      return RULE_IDS.paymentsRequireAuth;
    }
  }

  return null;
}

export function applyFlagChange<K extends FlagGroup>(
  flags: CreateFlags,
  key: K,
  value: SelectionValues[K]
): CreateFlags {
  const next = withSelection(flags, key, value);

  switch (key) {
    case 'backend':
      return applyBackendSideEffects(next, next.backend);
    case 'database':
      return applyDatabaseSideEffects(next, next.database);
    case 'auth':
      return applyAuthSideEffects(next, next.auth);
    case 'payments':
      return applyPaymentsSideEffects(next, next.payments);
    case 'dbSetup':
      return applyDbSetupSideEffects(next, next.dbSetup);
    case 'frontend':
    case 'api':
    case 'orm':
    case 'linting':
    case 'taskRunner':
    case 'toolchain':
    case 'form':
      return next;
    case 'structure':
      return {
        ...next,
        addons: {
          ...next.addons,
          taskRunner:
            next.structure === 'single' ? 'auto' : next.addons.taskRunner,
        },
      };
    default: {
      const _exhaustive: never = key;
      throw new Error(`unhandled flag group: ${_exhaustive}`);
    }
  }
}

function enabledFallback(
  flags: CreateFlags,
  group: FlagGroup
): SelectionValues[FlagGroup] {
  const preferred = selectionValue(YES_DEFAULTS, group);
  if (isOptionEnabled(flags, group, preferred)) {
    return preferred;
  }
  const vocab = VOCAB_BY_GROUP[group];
  if (
    vocab.some((value) => value === 'none') &&
    isOptionEnabled(flags, group, 'none')
  ) {
    return 'none';
  }
  for (const value of vocab) {
    if (isOptionEnabled(flags, group, value)) {
      return value;
    }
  }
  return preferred;
}

export function normalizeFlags(flags: CreateFlags): CreateFlags {
  let next = {
    ...YES_DEFAULTS,
    ...flags,
    addons: { ...YES_DEFAULTS.addons, ...flags.addons },
  };

  for (const group of FLAG_GROUPS) {
    if (isOptionEnabled(next, group, selectionValue(next, group))) {
      continue;
    }
    next = applyFlagChange(next, group, enabledFallback(next, group));
  }

  return next;
}

function applyBackendSideEffects(
  flags: CreateFlags,
  backend: Backend
): CreateFlags {
  switch (backend) {
    case 'nest':
    case 'hono':
      return {
        ...flags,
        structure: 'monorepo',
        addons: { ...flags.addons },
      };
    case 'self':
      return {
        ...flags,
        structure: 'single',
        addons: { ...flags.addons, taskRunner: 'auto' },
      };
    case 'convex':
      return {
        ...flags,
        structure: 'single',
        addons: { ...flags.addons, taskRunner: 'auto' },
        api: 'none',
        database: 'none',
        orm: 'none',
        dbSetup: 'none',
      };
    default: {
      const _exhaustive: never = backend;
      throw new Error(`unhandled backend: ${_exhaustive}`);
    }
  }
}

function applyDatabaseSideEffects(
  flags: CreateFlags,
  database: Database
): CreateFlags {
  if (database === 'none') {
    const next: CreateFlags = { ...flags, orm: 'none', dbSetup: 'none' };
    if (next.backend !== 'convex' && next.auth === 'better-auth') {
      return { ...next, auth: 'none', payments: 'none' };
    }
    return next;
  }
  if (databaseSetupRule(database, flags.dbSetup))
    return { ...flags, dbSetup: 'none' };
  if (flags.orm === 'none') {
    return { ...flags, orm: 'prisma' };
  }
  return flags;
}

function applyAuthSideEffects(flags: CreateFlags, auth: Auth): CreateFlags {
  if (auth === 'none') {
    return { ...flags, payments: 'none' };
  }
  if (auth !== 'better-auth' && flags.payments === 'polar') {
    return { ...flags, payments: 'none' };
  }
  return flags;
}

function applyPaymentsSideEffects(
  flags: CreateFlags,
  payments: Payments
): CreateFlags {
  if (payments !== 'none' && flags.auth === 'none') {
    return { ...flags, payments: 'none' };
  }
  if (payments === 'polar' && flags.auth !== 'better-auth') {
    return { ...flags, payments: 'none' };
  }
  return flags;
}

function applyDbSetupSideEffects(
  flags: CreateFlags,
  dbSetup: DbSetup
): CreateFlags {
  if (databaseSetupRule(flags.database, dbSetup))
    return { ...flags, dbSetup: 'none' };
  return flags;
}
