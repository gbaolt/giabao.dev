import { decodeLegacyPreset } from './legacy-preset';
import {
  canonicalRaw,
  parseConfiguration,
  selectionValue,
  withSelection,
} from './stack/configuration';
import { ParseError } from './stack/parse-error';
import { defaultStructureForBackend, YES_DEFAULTS } from './stack/resolve';
import { repairConfiguration } from './stack/rules';
import { FLAG_GROUPS, type FlagGroup, queryKey } from './stack/vocab';
import type { PresetFields, RawFlags } from './types/stack';

export {
  canonicalRaw,
  isAddonGroup,
  parseChoice,
  parseConfiguration,
  rawSelection,
  selectionValue,
  withSelection,
} from './stack/configuration';
export {
  CompatError,
  RULE_IDS,
  RULE_MESSAGES,
  type RuleId,
} from './stack/errors';
export {
  configurationDefaults,
  defaultStructureForBackend,
  resolveStack,
  YES_DEFAULTS,
} from './stack/resolve';
export {
  applyChange,
  type OptionState,
  optionState,
  repairConfiguration,
} from './stack/rules';
export * from './stack/vocab';
export type * from './types/stack';
export type { PresetFields as CreateFlags } from './types/stack';
export type PresetCode = string;

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Each slot is an explicit value index. Issued v2 IDs must never follow mutable defaults.
const V2_FIELDS = [
  'frontend',
  'backend',
  'structure',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
  'toolchain',
  'taskRunner',
  'linting',
  'form',
] as const satisfies readonly FlagGroup[];
const V2_VALUES = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'convex', 'hono'],
  structure: ['single', 'monorepo'],
  api: ['orpc', 'trpc', 'none'],
  database: ['postgres', 'sqlite', 'mysql', 'none'],
  orm: ['prisma', 'drizzle', 'none'],
  dbSetup: [
    'none',
    'docker',
    'neon',
    'supabase',
    'turso',
    'planetscale',
    'prisma-postgres',
  ],
  auth: ['better-auth', 'clerk', 'none'],
  payments: ['none', 'stripe', 'polar'],
  toolchain: ['standard'],
  taskRunner: ['auto', 'none', 'turborepo'],
  linting: ['auto', 'eslint', 'biome', 'oxlint'],
  form: ['none', 'react-hook-form', 'tanstack-form'],
} as const;

function base62(value: bigint): string {
  let remaining = value;
  let result = '';
  do {
    result = DIGITS[Number(remaining % 62n)] + result;
    remaining /= 62n;
  } while (remaining);
  return result;
}
export function encodePreset(fields: PresetFields): PresetCode {
  const parsed = parseConfiguration(fields);
  let packed = 0n;
  for (const [slot, key] of V2_FIELDS.entries()) {
    const index = V2_VALUES[key].findIndex(
      (value) => value === selectionValue(parsed, key)
    );
    if (index < 0) throw new ParseError(`unencodable ${key}`);
    packed |= BigInt(index) << BigInt(slot * 8);
  }
  return `gb-v2-${base62(packed)}`;
}
export function decodePreset(code: string): PresetFields {
  if (!code.startsWith('gb-v2-')) {
    const legacy = decodeLegacyPreset(code);
    const { linter, form, structure, ...core } = legacy;
    return {
      ...core,
      structure: structure === 'turborepo' ? 'monorepo' : 'single',
      addons: {
        toolchain: 'standard',
        taskRunner: structure === 'turborepo' ? 'turborepo' : 'none',
        linting: linter,
        form,
      },
    };
  }
  const payload = code.slice(6);
  if (!payload || payload.length > 18) throw new ParseError('invalid preset');
  let packed = 0n;
  for (const digit of payload) {
    const index = DIGITS.indexOf(digit);
    if (index < 0) throw new ParseError('invalid preset');
    packed = packed * 62n + BigInt(index);
  }
  if (base62(packed) !== payload || packed >> BigInt(V2_FIELDS.length * 8))
    throw new ParseError('invalid preset');
  const fields: Record<string, unknown> = { addons: {} };
  const addonValues: Record<string, unknown> = {};
  for (const [slot, key] of V2_FIELDS.entries()) {
    const value = V2_VALUES[key][Number((packed >> BigInt(slot * 8)) & 255n)];
    if (value === undefined) throw new ParseError('invalid preset');
    if (['toolchain', 'taskRunner', 'linting', 'form'].includes(key))
      addonValues[key] = value;
    else fields[key] = value;
  }
  return parseConfiguration({ ...fields, addons: addonValues });
}
export const GOLDEN_PRESETS = {
  nest: decodePreset('gb8wy'),
  start: decodePreset('gbh3b'),
  convex: decodePreset('gb60'),
};
export type GoldenName = keyof typeof GOLDEN_PRESETS;
export function rawFlagsFromPreset(fields: PresetFields): RawFlags {
  return { ...fields, addons: { ...fields.addons } };
}
export function parsePresetToken(token: string): RawFlags {
  const named = Object.entries(GOLDEN_PRESETS).find(([name]) => name === token);
  if (named) return rawFlagsFromPreset(named[1]);
  if (token.startsWith('gb')) return rawFlagsFromPreset(decodePreset(token));
  throw new ParseError(`unknown preset "${token}"`);
}
export function overlayRawFlags(base: RawFlags, explicit: RawFlags): RawFlags {
  const inherited = canonicalRaw(base);
  const overrides = canonicalRaw(explicit);
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(
      ([key, value]) =>
        key !== 'preset' && key !== 'addons' && value !== undefined
    )
  );
  const addonOverrides = Object.fromEntries(
    Object.entries(overrides.addons ?? {}).filter(
      ([, value]) => value !== undefined
    )
  );
  return {
    ...inherited,
    ...defined,
    addons: { ...inherited.addons, ...addonOverrides },
  };
}
export function configurationQuery(
  fields: PresetFields
): Record<string, string> {
  return Object.fromEntries([
    ['schema', '2'],
    ...FLAG_GROUPS.map((key) => [queryKey(key), selectionValue(fields, key)]),
  ]);
}
export function configurationFromQuery(
  query: Record<string, string | null>
): PresetFields {
  if (Object.values(query).every((value) => value === null))
    return { ...YES_DEFAULTS, addons: { ...YES_DEFAULTS.addons } };
  if (query.schema && query.schema !== '2')
    throw new ParseError('unsupported Configuration version');
  const legacy = !query.schema;
  let next = legacy
    ? decodePreset('gb0')
    : { ...YES_DEFAULTS, addons: { ...YES_DEFAULTS.addons } };
  for (const key of FLAG_GROUPS) {
    const value =
      query[queryKey(key)] ?? (key === 'linting' ? query.linter : undefined);
    if (!value) continue;
    if (key === 'structure' && value === 'turborepo') {
      next = {
        ...next,
        structure: 'monorepo',
        addons: { ...next.addons, taskRunner: 'turborepo' },
      };
      continue;
    }
    const candidate = withSelection(
      next,
      key,
      selectionValue(
        parseConfiguration({
          ...next,
          ...(key in next ? { [key]: value } : {}),
          addons: {
            ...next.addons,
            ...(!(key in next) ? { [key]: value } : {}),
          },
        }),
        key
      )
    );
    next = candidate;
  }
  if (
    !query.structure &&
    defaultStructureForBackend(next.backend) === 'monorepo'
  ) {
    next = {
      ...next,
      structure: 'monorepo',
      addons: {
        ...next.addons,
        ...(legacy && !query['task-runner']
          ? { taskRunner: 'turborepo' as const }
          : {}),
      },
    };
  }
  return repairConfiguration(next);
}
