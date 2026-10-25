export const RULE_IDS = {
  backendRequiresMonorepo: 'backend-requires-monorepo',
  turboRequiresMonorepo: 'turbo-requires-monorepo',
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
  nestTrpc: 'nest-trpc',
  biomeRequiresNestOrHono: 'biome-requires-nest-or-hono',
  startOrpcLimits: 'start-orpc-limits',
} as const;

export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS];

export const RULE_MESSAGES: Record<RuleId, string> = {
  'backend-requires-monorepo': 'Nest and Hono require a monorepo',
  'turbo-requires-monorepo': 'Choose a monorepo to use Turborepo',
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
  'nest-trpc': 'Nest tRPC generate is not implemented yet',
  'biome-requires-nest-or-hono':
    'Biome generate is only implemented for Nest and Hono',
  'start-orpc-limits':
    'Start with the built-in oRPC backend supports PostgreSQL, auth disabled or Better Auth, and no payments or database setup. Workspaces require the plain form',
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
