export { SHADCN_FOUNDATION } from '#/generate/assets/shadcn/metadata';
export { buildTree } from '#/generate/build-tree';
export type { GenerateGapCode } from '#/generate/errors';
export { GENERATE_GAPS, GenerateError } from '#/generate/errors';
export {
  isPackageManager,
  PACKAGE_MANAGER_METADATA,
} from '#/generate/package-managers';
export type { PresetCode } from '#/preset';
export { decodePreset, encodePreset, rawFlagsFromPreset } from '#/preset';
export {
  canonicalRaw,
  parseChoice,
  parseConfiguration,
  selectionValue,
  withSelection,
} from '#/stack/configuration';
export { CompatError, RULE_IDS } from '#/stack/errors';
export { ParseError } from '#/stack/parse-error';
export {
  defaultStructureForBackend,
  resolveStack,
  YES_DEFAULTS,
} from '#/stack/resolve';
export {
  ADDON_GROUPS,
  APIS,
  AUTHS,
  BACKENDS,
  CORE_GROUPS,
  DATABASES,
  DB_SETUPS,
  FLAG_GROUPS,
  FORMS,
  FRONTENDS,
  LINTERS,
  LINTING,
  ORMS,
  PAYMENTS,
  PROJECT_STRUCTURES,
  TASK_RUNNERS,
  TOOLCHAINS,
} from '#/stack/vocab';
export type {
  FileMap,
  GenerateContext,
  PackageManager,
} from '#/types/generate';
export type { Addons, SelectionValues } from '#/types/stack';
export type {
  Api,
  Auth,
  Backend,
  Database,
  DbSetup,
  Frontend,
  Linter,
  Orm,
  Payments,
  PresetFields,
  ProjectStructure,
  RawFlags,
  Stack,
} from '#/types/stack';
