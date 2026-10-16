import { ParseError } from './stack/parse-error';
import type { Form, Linter, PresetFields } from './types/stack';
type LegacyFields = Omit<PresetFields, 'addons' | 'structure'> & {
  structure: 'single' | 'turborepo';
  linter: Linter;
  form: Form;
};
type FlagGroup = keyof LegacyFields;
function defaultStructureForBackend(
  backend: LegacyFields['backend']
): LegacyFields['structure'] {
  return backend === 'nest' || backend === 'hono' ? 'turborepo' : 'single';
}
const LEGACY_PREFIX = 'gb';
const VERSIONED_PREFIX = 'gb-v1-';
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// These positions and values describe codes issued before preset versioning.
const LEGACY_FLAG_GROUPS = [
  'frontend',
  'backend',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
  'linter',
] as const satisfies readonly FlagGroup[];

const LEGACY_VOCAB_BY_GROUP = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'convex', 'hono'],
  api: ['orpc', 'trpc', 'none'],
  database: ['postgres', 'sqlite', 'mysql', 'none'],
  orm: ['prisma', 'drizzle', 'none'],
  dbSetup: ['none', 'docker', 'neon', 'supabase'],
  auth: ['better-auth', 'clerk', 'none'],
  payments: ['none', 'stripe', 'polar'],
  linter: ['eslint', 'biome', 'oxlint'],
} as const satisfies Record<
  (typeof LEGACY_FLAG_GROUPS)[number],
  readonly string[]
>;

// Version 1 assigns a stable byte to each field. Slot 9 is structure;
// Slot 10 is forms; slot 11 remains reserved without moving issued values.
const VERSIONED_FLAG_GROUPS = [
  'frontend',
  'backend',
  'api',
  'database',
  'orm',
  'dbSetup',
  'auth',
  'payments',
  'linter',
] as const satisfies readonly FlagGroup[];
const VERSIONED_VOCAB_BY_GROUP = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'convex', 'hono'],
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
  linter: ['eslint', 'biome', 'oxlint'],
} as const satisfies Record<
  (typeof VERSIONED_FLAG_GROUPS)[number],
  readonly string[]
>;
const VERSIONED_SLOT_COUNT = 12;
const VERSIONED_SLOT_BITS = BigInt(8);
const STRUCTURE_SLOT = 9;
const FORM_SLOT = 10;
const VERSIONED_FORMS = ['none', 'react-hook-form', 'tanstack-form'] as const;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const BASE = BigInt(62);
const EXTENDED_DB_SETUPS = [
  null,
  'turso',
  'planetscale',
  'prisma-postgres',
] as const;

function fieldBits(length: number): number {
  return Math.max(1, Math.ceil(Math.log2(length)));
}

function encodeBase62(value: bigint): string {
  if (value === ZERO) {
    return '0';
  }
  const digits: string[] = [];
  let current = value;
  while (current > ZERO) {
    digits.push(BASE62[Number(current % BASE)] ?? '');
    current /= BASE;
  }
  return digits.reverse().join('');
}

function decodeBase62(payload: string, code: string): bigint {
  let value = ZERO;
  for (const char of payload) {
    const index = BASE62.indexOf(char);
    if (index < 0) {
      throw new ParseError(`invalid preset "${code}"`);
    }
    value = value * BASE + BigInt(index);
  }
  return value;
}

export function decodeLegacyPreset(code: string): LegacyFields {
  if (code.startsWith(VERSIONED_PREFIX)) {
    return decodeVersionedPreset(code);
  }
  if (/^gb-v\d+-/.test(code)) {
    throw new ParseError(`unsupported preset version "${code}"`);
  }
  if (!code.startsWith(LEGACY_PREFIX)) {
    throw new ParseError(`invalid preset "${code}"`);
  }
  const packed = parsePayload(code.slice(LEGACY_PREFIX.length), code);

  const totalBits = LEGACY_FLAG_GROUPS.reduce(
    (sum, group) => sum + fieldBits(LEGACY_VOCAB_BY_GROUP[group].length),
    0
  );
  const fields = {} as LegacyFields;
  let shift = 0;
  for (const group of LEGACY_FLAG_GROUPS) {
    const vocab = LEGACY_VOCAB_BY_GROUP[group];
    const bits = fieldBits(vocab.length);
    const mask = (ONE << BigInt(bits)) - ONE;
    const index = Number((packed >> BigInt(shift)) & mask);
    const value = vocab[index];
    if (value === undefined) {
      throw new ParseError(`invalid preset "${code}"`);
    }
    assignField(fields, group, value);
    shift += bits;
  }

  fields.structure = defaultStructureForBackend(fields.backend);
  fields.form = 'none';

  const extension = packed >> BigInt(totalBits);
  if (extension !== ZERO) {
    if ((extension & ONE) !== ONE || extension >> BigInt(7)) {
      throw new ParseError(`invalid preset "${code}"`);
    }
    const setupId = Number((extension >> ONE) & BigInt(3));
    const setup = EXTENDED_DB_SETUPS[setupId];
    if (setup === undefined) throw new ParseError(`invalid preset "${code}"`);
    if (setup !== null) fields.dbSetup = setup;
    const structureId = Number((extension >> BigInt(3)) & BigInt(3));
    if (structureId === 1) fields.structure = 'turborepo';
    else if (structureId === 2) fields.structure = 'single';
    else if (structureId !== 0)
      throw new ParseError(`invalid preset "${code}"`);
    const formId = Number((extension >> BigInt(5)) & BigInt(3));
    const form = VERSIONED_FORMS[formId];
    if (!form) throw new ParseError(`invalid preset "${code}"`);
    fields.form = form;
  }

  return fields;
}

function parsePayload(payload: string, code: string): bigint {
  if (payload.length === 0 || payload.length > 17) {
    throw new ParseError(`invalid preset "${code}"`);
  }
  const packed = decodeBase62(payload, code);
  if (payload !== encodeBase62(packed)) {
    throw new ParseError(`invalid preset "${code}"`);
  }
  return packed;
}

function decodeVersionedPreset(code: string): LegacyFields {
  const packed = parsePayload(code.slice(VERSIONED_PREFIX.length), code);
  if (packed >= ONE << (BigInt(VERSIONED_SLOT_COUNT) * VERSIONED_SLOT_BITS)) {
    throw new ParseError(`invalid preset "${code}"`);
  }
  // Unassigned slots must be zero until a later schema defines their meaning.
  if (packed >> (BigInt(FORM_SLOT + 1) * VERSIONED_SLOT_BITS)) {
    throw new ParseError(`invalid preset "${code}"`);
  }

  const fields = {} as LegacyFields;
  const formId = Number(
    (packed >> (BigInt(FORM_SLOT) * VERSIONED_SLOT_BITS)) & BigInt(255)
  );
  const form = VERSIONED_FORMS[formId];
  if (form === undefined) throw new ParseError(`invalid preset "${code}"`);
  fields.form = form;
  for (const [slot, group] of VERSIONED_FLAG_GROUPS.entries()) {
    const vocab = VERSIONED_VOCAB_BY_GROUP[group];
    const index = Number(
      (packed >> (BigInt(slot) * VERSIONED_SLOT_BITS)) & BigInt(255)
    );
    const value = vocab[index];
    if (value === undefined) {
      throw new ParseError(`invalid preset "${code}"`);
    }
    assignField(fields, group, value);
  }

  const structureId = Number(
    (packed >> (BigInt(STRUCTURE_SLOT) * VERSIONED_SLOT_BITS)) & BigInt(255)
  );
  switch (structureId) {
    case 0:
      fields.structure = defaultStructureForBackend(fields.backend);
      break;
    case 1:
      fields.structure = 'turborepo';
      break;
    case 2:
      fields.structure = 'single';
      break;
    default:
      throw new ParseError(`invalid preset "${code}"`);
  }

  return fields;
}

function assignField(
  target: LegacyFields,
  group: FlagGroup,
  value: string
): void {
  switch (group) {
    case 'frontend':
      target.frontend = value as LegacyFields['frontend'];
      return;
    case 'backend':
      target.backend = value as LegacyFields['backend'];
      return;
    case 'structure':
      target.structure = value as LegacyFields['structure'];
      return;
    case 'api':
      target.api = value as LegacyFields['api'];
      return;
    case 'database':
      target.database = value as LegacyFields['database'];
      return;
    case 'orm':
      target.orm = value as LegacyFields['orm'];
      return;
    case 'dbSetup':
      target.dbSetup = value as LegacyFields['dbSetup'];
      return;
    case 'auth':
      target.auth = value as LegacyFields['auth'];
      return;
    case 'payments':
      target.payments = value as LegacyFields['payments'];
      return;
    case 'linter':
      target.linter = value as LegacyFields['linter'];
      return;
    case 'form':
      target.form = value as LegacyFields['form'];
      return;
    default: {
      const _exhaustive: never = group;
      throw new Error(`unhandled group: ${_exhaustive}`);
    }
  }
}
