import 'server-only';

import {
  buildTree,
  CompatError,
  GenerateError,
  type PackageManager,
  parseConfiguration,
  type RawFlags,
  resolveStack,
} from 'create-gb-app/generate';
import type { CreateFlags } from 'create-gb-app/preset';

import { resolveProjectName } from './command';

export function isCreateFlags(value: unknown): value is CreateFlags {
  try {
    parseConfiguration(value);
    return true;
  } catch {
    return false;
  }
}
export type CreateFileMapResult =
  | { ok: true; files: Record<string, string> }
  | { ok: false; message: string; code: string };
export function flagsToRaw(flags: CreateFlags): RawFlags {
  return flags;
}
export function buildCreateFileMap(
  flags: CreateFlags,
  projectName: string,
  packageManager: PackageManager = 'bun'
): CreateFileMapResult {
  try {
    const configuration = parseConfiguration(flags);
    const files = buildTree(resolveStack(configuration), {
      projectName: resolveProjectName(projectName),
      packageManager,
    });
    return { ok: true, files };
  } catch (error) {
    if (error instanceof GenerateError)
      return { ok: false, message: error.message, code: error.code };
    if (error instanceof CompatError)
      return { ok: false, message: error.message, code: error.ruleId };
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'generate failed',
      code: 'invalid',
    };
  }
}
