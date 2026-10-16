#!/usr/bin/env bun

import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pkg from '../package.json' with { type: 'json' };
import {
  ALL_TARGETS,
  binaryFileName,
  bunCompileTarget,
  type CompileTarget,
  hostTarget,
  platformPackageName,
} from './targets';
import { syncTemplates } from './templates';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
process.chdir(root);

const allFlag = process.argv.includes('--all');
const skipInstall = process.argv.includes('--skip-install');

const targets: CompileTarget[] = allFlag ? ALL_TARGETS : [hostTarget()];

await syncTemplates({ check: true });

await rm(join(root, 'dist'), { recursive: true, force: true });

if (!skipInstall) {
  const proc = Bun.spawn(
    [
      'bun',
      'install',
      '--os=*',
      '--cpu=*',
      `@opentui/core@${pkg.optionalDependencies['@opentui/core']}`,
    ],
    { cwd: root, stdout: 'inherit', stderr: 'inherit' }
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error('failed to install OpenTUI native packages');
  }
}

const binaries: Record<string, string> = {};
const host = hostTarget();

for (const item of targets) {
  const name = platformPackageName(item, pkg.name);
  const outDir = join(root, 'dist', name, 'bin');
  await mkdir(outDir, { recursive: true });
  console.log(`building ${name}`);

  const define: Record<string, string> = {
    CREATE_GB_APP_VERSION: JSON.stringify(pkg.version),
  };
  if (item.os === 'linux') {
    define['process.env.OPENTUI_LIBC'] = JSON.stringify(item.abi ?? 'glibc');
  }

  const outfileName = binaryFileName(item.os);
  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    minify: true,
    compile: {
      target: bunCompileTarget(item) as never,
      outfile: join(outDir, outfileName),
    },
    define,
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  const isHostBuild =
    item.os === host.os &&
    item.arch === host.arch &&
    item.abi === host.abi &&
    item.avx2 === host.avx2;
  if (isHostBuild) {
    const binaryPath = join(outDir, outfileName);
    const smoke = Bun.spawn([binaryPath, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(smoke.stdout).text();
    const stderr = await new Response(smoke.stderr).text();
    const code = await smoke.exited;
    if (code !== 0 || !stdout.includes('create-gb-app')) {
      console.error(stdout, stderr);
      throw new Error(`smoke test failed for ${name}`);
    }
    console.log(`smoke test passed: ${name} --help`);
  }

  await Bun.write(
    join(root, 'dist', name, 'package.json'),
    `${JSON.stringify(
      {
        name,
        version: pkg.version,
        preferUnplugged: true,
        os: [item.os],
        cpu: [item.arch],
        ...(item.abi ? { libc: [item.abi] } : {}),
      },
      null,
      2
    )}\n`
  );
  binaries[name] = pkg.version;
}

export { binaries };
