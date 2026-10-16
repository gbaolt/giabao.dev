'use server';

import { isPackageManager, type PackageManager } from 'create-gb-app/generate';
import type { CreateFlags } from 'create-gb-app/preset';

import {
  buildCreateFileMap,
  type CreateFileMapResult,
  isCreateFlags,
} from '../generate-files';

export async function generatePreview(
  flags: CreateFlags,
  projectName: string,
  packageManager: PackageManager = 'bun'
): Promise<CreateFileMapResult> {
  if (
    !isCreateFlags(flags) ||
    typeof projectName !== 'string' ||
    !isPackageManager(packageManager)
  ) {
    return { ok: false, message: 'invalid flags', code: 'invalid' };
  }

  return buildCreateFileMap(flags, projectName, packageManager);
}
