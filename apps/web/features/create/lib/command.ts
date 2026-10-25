import type { CreateFlags } from 'create-gb-app/preset';
import { encodePreset } from 'create-gb-app/preset';

export const DEFAULT_PROJECT_NAME = 'my-gb-app';
export const DEFAULT_COMMAND = 'npx create-gb-app my-gb-app';

export { encodePreset };

export function resolveProjectName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PROJECT_NAME;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9._@/=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function buildCommand(
  flags: CreateFlags,
  projectName = DEFAULT_PROJECT_NAME
): string {
  const dir = shellQuote(resolveProjectName(projectName));
  const parts = ['npx', 'create-gb-app', dir];
  const preset = encodePreset(flags);
  if (preset) {
    parts.push('--preset', preset);
  }
  return parts.join(' ');
}
