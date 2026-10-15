export const RULE_IDS = {
  backendRequiresMonorepo: 'backend-requires-monorepo',
  turboRequiresMonorepo: 'turbo-requires-monorepo',
  optionalTurborepoUnavailable: 'optional-turborepo-unavailable',
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

const RULE_MESSAGES: Record<RuleId, string> = {
  'backend-requires-monorepo': 'Nest and Hono require a monorepo',
  'turbo-requires-monorepo': 'Choose a monorepo to use Turborepo',
  'optional-turborepo-unavailable':
    'Turborepo for this backend is not available yet',
  'polar-requires-better-auth': 'Polar requires Better Auth',
  'payments-require-auth': 'Payments require auth',
  'convex-database-off': 'Convex cannot use a database',
  'convex-api-off': 'Convex cannot use an API layer',
  'convex-orm-off': 'Convex cannot use an ORM',
  'convex-db-setup-off': 'Convex cannot use db-setup',
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

export class CompatError extends Error {
  readonly ruleId: RuleId;

  constructor(ruleId: RuleId) {
    super(`${RULE_MESSAGES[ruleId]} (${ruleId})`);
    this.name = 'CompatError';
    this.ruleId = ruleId;
    Object.defineProperty(this, 'ruleId', {
      value: ruleId,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }
}
