import { canonicalRaw, overlayRawFlags, parsePresetToken } from '#/preset';
import { ParseError } from '#/stack/parse-error';
import { defaultStructureForBackend } from '#/stack/resolve';
import {
  APIS,
  AUTHS,
  BACKENDS,
  DATABASES,
  DB_SETUPS,
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
import type { RawFlags } from '#/types/stack';

export { ParseError };

function oneOf<T extends string>(
  name: string,
  value: string,
  allowed: readonly T[]
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new ParseError(
    `invalid ${name} "${value}". expected ${allowed.join('|')}`
  );
}

function takeValue(
  argv: string[],
  index: number,
  name: string
): {
  value: string;
  consumed: number;
} {
  const current = argv[index];
  const eq = current.indexOf('=');
  if (eq >= 0) {
    const value = current.slice(eq + 1);
    if (!value) {
      throw new ParseError(`missing value for ${name}`);
    }
    return { value, consumed: 0 };
  }
  const next = argv[index + 1];
  if (!next || next.startsWith('-')) {
    throw new ParseError(`missing value for ${name}`);
  }
  return { value: next, consumed: 1 };
}

export function shouldGenerateHeadless(
  flags: RawFlags,
  interactive: boolean
): boolean {
  return (
    Boolean(flags.yes) ||
    Boolean(flags.preset) ||
    Boolean(flags.projectName) ||
    !interactive
  );
}

export function parseArgs(argv: string[]): RawFlags {
  const flags: RawFlags = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      flags.version = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      flags.yes = true;
      continue;
    }
    if (arg === '--no-git') {
      flags.noGit = true;
      continue;
    }
    if (arg === '--no-install') {
      flags.noInstall = true;
      continue;
    }
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }

    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    switch (name) {
      case '--preset': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.preset = value;
        i += consumed;
        break;
      }
      case '--frontend': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.frontend = oneOf('frontend', value, FRONTENDS);
        i += consumed;
        break;
      }
      case '--backend': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.backend = oneOf('backend', value, BACKENDS);
        i += consumed;
        break;
      }
      case '--structure': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.structure = oneOf('structure', value, [
          ...PROJECT_STRUCTURES,
          'turborepo',
        ] as const);
        i += consumed;
        break;
      }
      case '--api': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.api = oneOf('api', value, APIS);
        i += consumed;
        break;
      }
      case '--database': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.database = oneOf('database', value, DATABASES);
        i += consumed;
        break;
      }
      case '--orm': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.orm = oneOf('orm', value, ORMS);
        i += consumed;
        break;
      }
      case '--db-setup': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.dbSetup = oneOf('db-setup', value, DB_SETUPS);
        i += consumed;
        break;
      }
      case '--auth': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.auth = oneOf('auth', value, AUTHS);
        i += consumed;
        break;
      }
      case '--payments': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.payments = oneOf('payments', value, PAYMENTS);
        i += consumed;
        break;
      }
      case '--form': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.addons = { ...flags.addons, form: oneOf('form', value, FORMS) };
        i += consumed;
        break;
      }
      case '--toolchain': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.addons = {
          ...flags.addons,
          toolchain: oneOf('toolchain', value, TOOLCHAINS),
        };
        i += consumed;
        break;
      }
      case '--task-runner': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.addons = {
          ...flags.addons,
          taskRunner: oneOf('task runner', value, TASK_RUNNERS),
        };
        i += consumed;
        break;
      }
      case '--linting': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.addons = {
          ...flags.addons,
          linting: oneOf('linting', value, LINTING),
        };
        i += consumed;
        break;
      }
      case '--linter': {
        const { value, consumed } = takeValue(argv, i, name);
        flags.linter = oneOf('linter', value, LINTERS);
        i += consumed;
        break;
      }
      default:
        throw new ParseError(`unknown flag ${name}`);
    }
  }

  if (positionals.length > 1) {
    throw new ParseError(
      `unexpected extra arguments: ${positionals.slice(1).join(' ')}`
    );
  }
  if (positionals[0]) {
    flags.projectName = positionals[0];
  }

  const token = flags.preset;
  if (token === undefined) {
    return canonicalRaw(flags);
  }

  try {
    const { preset: _token, ...explicit } = flags;
    void _token;
    const presetFlags = parsePresetToken(token);
    const merged = overlayRawFlags({ ...presetFlags, preset: token }, explicit);
    if (
      explicit.backend !== undefined &&
      explicit.backend !== presetFlags.backend &&
      explicit.structure === undefined
    ) {
      merged.structure = defaultStructureForBackend(explicit.backend);
      if (
        merged.structure === 'single' &&
        explicit.addons?.taskRunner === undefined
      ) {
        merged.addons = { ...merged.addons, taskRunner: 'auto' };
      }
    }
    return merged;
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(
      error instanceof Error ? error.message : `invalid --preset ${token}`
    );
  }
}

export const USAGE = `create-gb-app [dir] [flags]

  bunx --bun create-gb-app my-gb-app
  bunx --bun create-gb-app my-gb-app --preset nest
  bunx --bun create-gb-app my-gb-app --preset gb0

Flags
  --help, -h
  --version, -v
  --yes, -y
  --preset <nest|start|convex|gb…>
  --frontend next|tanstack-start
  --backend self|nest|convex|hono
  --structure single|monorepo (Nest and Hono require monorepo; turborepo is a legacy alias)
  --api orpc|trpc|none
  --database postgres|sqlite|mysql|none
  --orm prisma|drizzle|none
  --db-setup none|docker|neon|supabase|turso|planetscale|prisma-postgres
  --auth better-auth|clerk|none
  --payments none|stripe|polar
  --toolchain standard
  --task-runner auto|none|turborepo
  --linting auto|eslint|biome|oxlint
  --linter eslint|biome|oxlint (legacy alias)
  --form none|react-hook-form|tanstack-form
  --no-git
  --no-install
`;
