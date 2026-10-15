import type {
  Addons,
  PresetFields,
  RawFlags,
  SelectionValues,
} from '#/types/stack';

import { ParseError } from './parse-error';
import {
  ADDON_GROUPS,
  CORE_GROUPS,
  type FlagGroup,
  VOCAB_BY_GROUP,
} from './vocab';

export function isAddonGroup(group: FlagGroup): group is keyof Addons {
  return ADDON_GROUPS.some((key) => key === group);
}
export function selectionValue<K extends FlagGroup>(
  fields: PresetFields,
  key: K
): SelectionValues[K] {
  return { ...fields, ...fields.addons }[key];
}
export function withSelection<K extends FlagGroup>(
  fields: PresetFields,
  key: K,
  value: SelectionValues[K]
): PresetFields {
  return isAddonGroup(key)
    ? { ...fields, addons: { ...fields.addons, [key]: value } }
    : { ...fields, [key]: value };
}
export function parseChoice<T extends string>(
  name: string,
  value: unknown,
  choices: readonly T[]
): T {
  const result = choices.find((choice) => choice === value);
  if (result === undefined)
    throw new ParseError(`invalid ${name}: expected ${choices.join('|')}`);
  return result;
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ParseError('invalid Configuration');
  return Object.fromEntries(Object.entries(value));
}
export function parseConfiguration(value: unknown): PresetFields {
  const core = record(value);
  const addons = record(core.addons);
  return {
    frontend: parseChoice('frontend', core.frontend, VOCAB_BY_GROUP.frontend),
    backend: parseChoice('backend', core.backend, VOCAB_BY_GROUP.backend),
    structure: parseChoice(
      'structure',
      core.structure,
      VOCAB_BY_GROUP.structure
    ),
    api: parseChoice('api', core.api, VOCAB_BY_GROUP.api),
    database: parseChoice('database', core.database, VOCAB_BY_GROUP.database),
    orm: parseChoice('orm', core.orm, VOCAB_BY_GROUP.orm),
    dbSetup: parseChoice('dbSetup', core.dbSetup, VOCAB_BY_GROUP.dbSetup),
    auth: parseChoice('auth', core.auth, VOCAB_BY_GROUP.auth),
    payments: parseChoice('payments', core.payments, VOCAB_BY_GROUP.payments),
    addons: {
      toolchain: parseChoice(
        'toolchain',
        addons.toolchain,
        VOCAB_BY_GROUP.toolchain
      ),
      taskRunner: parseChoice(
        'taskRunner',
        addons.taskRunner,
        VOCAB_BY_GROUP.taskRunner
      ),
      linting: parseChoice('linting', addons.linting, VOCAB_BY_GROUP.linting),
      form: parseChoice('form', addons.form, VOCAB_BY_GROUP.form),
    },
  };
}
export function rawSelection(
  raw: RawFlags,
  group: FlagGroup
): string | undefined {
  if (isAddonGroup(group))
    return (
      raw.addons?.[group] ??
      (group === 'linting'
        ? raw.linter
        : group === 'form'
          ? raw.form
          : undefined)
    );
  return raw[group];
}
export function canonicalRaw(
  raw: RawFlags
): Omit<RawFlags, 'structure'> & { structure?: PresetFields['structure'] } {
  const { linter, form, structure: originalStructure, ...rest } = raw;
  const structure =
    originalStructure === 'turborepo' ? 'monorepo' : originalStructure;
  const explicitAddons = { ...rest.addons };
  for (const key of ADDON_GROUPS) {
    if (explicitAddons[key] === undefined) delete explicitAddons[key];
  }
  const addons = {
    ...(linter === undefined ? {} : { linting: linter }),
    ...(form === undefined ? {} : { form }),
    ...(originalStructure === 'turborepo'
      ? { taskRunner: 'turborepo' as const }
      : {}),
    ...explicitAddons,
  };
  return {
    ...rest,
    ...(structure === undefined ? {} : { structure }),
    ...(Object.keys(addons).length ? { addons } : {}),
  };
}
export { CORE_GROUPS };
