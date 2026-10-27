import { canonicalRaw, overlayRawFlags, parsePresetToken } from '#/preset';
import { isAddonGroup, parseChoice } from '#/stack/configuration';
import { ParseError } from '#/stack/parse-error';
import { defaultStructureForBackend } from '#/stack/resolve';
import {
  LINTERS,
  PROJECT_STRUCTURES,
  STACK_CLI_FLAGS,
  VOCAB_BY_GROUP,
} from '#/stack/vocab';
import type { RawFlags } from '#/types/stack';

export { ParseError };

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
    const stackFlag = STACK_CLI_FLAGS.find(({ flag }) => flag === name);
    if (name !== '--preset' && name !== '--linter' && !stackFlag)
      throw new ParseError(`unknown flag ${name}`);
    const { value, consumed } = takeValue(argv, i, name);
    i += consumed;
    if (name === '--preset') flags.preset = value;
    else if (name === '--linter')
      flags.linter = parseChoice('linter', value, LINTERS);
    else if (stackFlag?.key === 'structure')
      flags.structure = parseChoice('structure', value, [
        ...PROJECT_STRUCTURES,
        'turborepo',
      ] as const);
    else if (stackFlag && isAddonGroup(stackFlag.key))
      flags.addons = Object.assign(
        { ...flags.addons },
        {
          [stackFlag.key]: parseChoice(
            name,
            value,
            VOCAB_BY_GROUP[stackFlag.key]
          ),
        }
      );
    else if (stackFlag)
      Object.assign(flags, {
        [stackFlag.key]: parseChoice(
          name,
          value,
          VOCAB_BY_GROUP[stackFlag.key]
        ),
      });
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
