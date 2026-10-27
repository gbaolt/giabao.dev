import type { PresetFields, RawFlags, Stack } from '#/types/stack';

import { canonicalRaw } from './configuration';
import { CompatError } from './errors';
import { defaultStructureForBackend, violatedRule } from './rules';

export { defaultStructureForBackend };

export const YES_DEFAULTS = {
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
    taskRunner: 'auto',
    linting: 'auto',
    form: 'none',
  },
} as const satisfies PresetFields;

// Fills unset selections the way `--yes` would, without checking any rule.
export function configurationDefaults(input: RawFlags): PresetFields {
  const raw = canonicalRaw(input);
  const backend = raw.backend ?? YES_DEFAULTS.backend;
  const convex = backend === 'convex';
  const database = raw.database ?? (convex ? 'none' : YES_DEFAULTS.database);
  return {
    frontend: raw.frontend ?? YES_DEFAULTS.frontend,
    backend,
    structure: raw.structure ?? defaultStructureForBackend(backend),
    api: raw.api ?? (convex ? 'none' : YES_DEFAULTS.api),
    database,
    orm: raw.orm ?? (database === 'none' ? 'none' : YES_DEFAULTS.orm),
    dbSetup: raw.dbSetup ?? YES_DEFAULTS.dbSetup,
    auth: raw.auth ?? YES_DEFAULTS.auth,
    payments: raw.payments ?? YES_DEFAULTS.payments,
    addons: { ...YES_DEFAULTS.addons, ...raw.addons },
  };
}

export function resolveStack(input: RawFlags): Stack {
  const configuration = configurationDefaults(input);
  const ruleId = violatedRule(configuration);
  if (ruleId) throw new CompatError(ruleId);

  const { frontend, backend, structure, auth, payments, addons } =
    configuration;
  const shared = {
    frontend,
    auth,
    payments,
    addons: {
      ...addons,
      linting: addons.linting === 'auto' ? 'eslint' : addons.linting,
      taskRunner: addons.taskRunner === 'auto' ? 'none' : addons.taskRunner,
    },
  } as const;
  if (backend === 'convex') return { ...shared, backend, structure };

  const { api, database, orm, dbSetup } = configuration;
  const relational = { api, database, orm, dbSetup };
  if (backend === 'nest' || backend === 'hono')
    return { ...shared, ...relational, backend, structure: 'monorepo' };
  return { ...shared, ...relational, backend, structure };
}
