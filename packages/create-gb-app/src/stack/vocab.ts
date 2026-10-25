export const FRONTENDS = ['next', 'tanstack-start'] as const;
export const BACKENDS = ['self', 'nest', 'convex', 'hono'] as const;
export const PROJECT_STRUCTURES = ['single', 'monorepo'] as const;
export const APIS = ['orpc', 'trpc', 'none'] as const;
export const DATABASES = ['postgres', 'sqlite', 'mysql', 'none'] as const;
export const ORMS = ['prisma', 'drizzle', 'none'] as const;
export const DB_SETUPS = [
  'none',
  'docker',
  'neon',
  'supabase',
  'turso',
  'planetscale',
  'prisma-postgres',
] as const;
export const AUTHS = ['better-auth', 'clerk', 'none'] as const;
export const PAYMENTS = ['none', 'stripe', 'polar'] as const;
export const LINTERS = ['eslint', 'biome', 'oxlint'] as const;
export const FORMS = ['none', 'react-hook-form', 'tanstack-form'] as const;

export const TASK_RUNNERS = ['auto', 'none', 'turborepo'] as const;
export const TOOLCHAINS = ['standard'] as const;
export const LINTING = ['auto', ...LINTERS] as const;
export const CORE_GROUPS = [
  'frontend',
  'backend',
  'structure',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
] as const;
export const ADDON_GROUPS = [
  'toolchain',
  'taskRunner',
  'linting',
  'form',
] as const;
export const FLAG_GROUPS = [...CORE_GROUPS, ...ADDON_GROUPS] as const;
export type FlagGroup = (typeof FLAG_GROUPS)[number];
export const VOCAB_BY_GROUP = {
  frontend: FRONTENDS,
  backend: BACKENDS,
  structure: PROJECT_STRUCTURES,
  api: APIS,
  database: DATABASES,
  orm: ORMS,
  dbSetup: DB_SETUPS,
  auth: AUTHS,
  payments: PAYMENTS,
  toolchain: TOOLCHAINS,
  taskRunner: TASK_RUNNERS,
  linting: LINTING,
  form: FORMS,
} as const satisfies Record<FlagGroup, readonly string[]>;
export const RELATIONAL_GROUPS = ['api', 'database', 'orm', 'dbSetup'] as const;
// The name a group uses in CLI flags and Create page query strings.
export function queryKey(group: FlagGroup): string {
  return group === 'dbSetup'
    ? 'db-setup'
    : group === 'taskRunner'
      ? 'task-runner'
      : group;
}
export const STACK_CLI_FLAGS: { key: FlagGroup; flag: string }[] =
  FLAG_GROUPS.map((key) => ({ key, flag: `--${queryKey(key)}` }));
