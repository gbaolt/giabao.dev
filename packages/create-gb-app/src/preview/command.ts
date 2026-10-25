import { parsePresetToken, rawSelection, selectionValue } from '#/preset';
import { configurationDefaults } from '#/stack/resolve';
import type { FlagGroup } from '#/stack/vocab';
import { STACK_CLI_FLAGS } from '#/stack/vocab';
import type { RawFlags } from '#/types/stack';

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9._@/=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function impliedValue(
  baseline: RawFlags,
  flags: RawFlags,
  key: FlagGroup
): string {
  // Relational defaults depend on the chosen backend (Convex implies none);
  // structure follows the baseline backend so a chosen layout stays explicit.
  const backend =
    key === 'backend' || key === 'structure' ? baseline.backend : flags.backend;
  return selectionValue(
    configurationDefaults({
      ...baseline,
      backend: backend ?? baseline.backend,
    }),
    key
  );
}

function definedEntries(flags: RawFlags): Array<[string, string]> {
  const baseline = flags.preset ? parsePresetToken(flags.preset) : {};
  const entries: Array<[string, string]> = [];
  for (const { key, flag } of STACK_CLI_FLAGS) {
    const current = rawSelection(flags, key);
    if (
      current === undefined ||
      current === impliedValue(baseline, flags, key)
    ) {
      continue;
    }
    entries.push([flag, current]);
  }
  return entries;
}

export function formatCommand(flags: RawFlags): string {
  const dir = shellQuote(flags.projectName ?? 'my-gb-app');
  const parts = ['create-gb-app', dir];
  if (flags.preset) {
    parts.push('--preset', shellQuote(flags.preset));
  }
  for (const [flag, value] of definedEntries(flags)) {
    parts.push(flag, shellQuote(value));
  }
  if (flags.noGit) {
    parts.push('--no-git');
  }
  if (flags.noInstall) {
    parts.push('--no-install');
  }
  return parts.join(' ');
}
