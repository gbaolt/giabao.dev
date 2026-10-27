// Installs a pairwise-covering set of generated stacks and runs build, typecheck and lint in each.
// Usage: bun script/verify-static.ts <outDir> [--list] [--only=c01,c07] [--keep]
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  buildTree,
  CompatError,
  type PackageManager,
  resolveStack,
} from '../src/generate/public';
import { writeTree } from '../src/generate/write-tree';
import type { RawFlags, Stack } from '../src/types/stack';

const AXES = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'hono', 'convex'],
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
  form: ['none', 'react-hook-form', 'tanstack-form'],
  linting: ['eslint', 'oxlint', 'biome'],
  taskRunner: ['none', 'turborepo'],
  packageManager: ['bun', 'npm', 'pnpm'],
} as const;
type Axis = keyof typeof AXES;
type Candidate = {
  raw: RawFlags;
  stack: Stack;
  packageManager: PackageManager;
};

function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function facets(candidate: Candidate): Record<Axis, string> {
  const { stack } = candidate;
  return {
    frontend: stack.frontend,
    backend: stack.backend,
    structure: stack.structure,
    api: 'api' in stack ? stack.api : 'none',
    database: 'database' in stack ? stack.database : 'none',
    orm: 'orm' in stack ? stack.orm : 'none',
    dbSetup: 'dbSetup' in stack ? stack.dbSetup : 'none',
    auth: stack.auth,
    payments: stack.payments,
    form: stack.addons.form,
    linting: stack.addons.linting,
    taskRunner: stack.addons.taskRunner,
    packageManager: candidate.packageManager,
  };
}

function pairs(candidate: Candidate): string[] {
  const entries = Object.entries(facets(candidate));
  const out: string[] = [];
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++)
      out.push(
        `${entries[i]![0]}=${entries[i]![1]}&${entries[j]![0]}=${entries[j]![1]}`
      );
  return out;
}

export function pairwiseCases(samples = 20000, seed = 1): Candidate[] {
  const next = random(seed);
  const pick = <T>(values: readonly T[]) =>
    values[Math.floor(next() * values.length)]!;
  const pool: Candidate[] = [];
  for (let i = 0; i < samples; i++) {
    const raw: RawFlags = {
      frontend: pick(AXES.frontend),
      backend: pick(AXES.backend),
      structure: pick(AXES.structure),
      api: pick(AXES.api),
      database: pick(AXES.database),
      orm: pick(AXES.orm),
      dbSetup: pick(AXES.dbSetup),
      auth: pick(AXES.auth),
      payments: pick(AXES.payments),
      addons: {
        form: pick(AXES.form),
        linting: pick(AXES.linting),
        taskRunner: pick(AXES.taskRunner),
      },
    };
    if (raw.backend === 'convex')
      for (const key of ['api', 'database', 'orm', 'dbSetup'] as const)
        delete raw[key];
    try {
      pool.push({
        raw,
        stack: resolveStack(raw),
        packageManager: pick(AXES.packageManager),
      });
    } catch (error) {
      if (!(error instanceof CompatError)) throw error;
    }
  }
  const uncovered = new Set(pool.flatMap(pairs));
  const chosen: Candidate[] = [];
  while (uncovered.size > 0) {
    let best = pool[0]!;
    let bestGain = -1;
    for (const candidate of pool) {
      const gain = pairs(candidate).filter((pair) =>
        uncovered.has(pair)
      ).length;
      if (gain > bestGain) [best, bestGain] = [candidate, gain];
    }
    for (const pair of pairs(best)) uncovered.delete(pair);
    chosen.push(best);
  }
  return chosen;
}

function caseName(index: number, candidate: Candidate): string {
  const f = facets(candidate);
  return `c${String(index + 1).padStart(2, '0')}-${f.frontend === 'next' ? 'next' : 'start'}-${f.backend}-${f.api}-${f.orm}-${f.auth}-${f.packageManager}`;
}

async function run(
  command: string[],
  cwd: string,
  log: string
): Promise<number> {
  await appendFile(log, `\n$ ${command.join(' ')}\n`);
  const child = Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
    },
  });
  const timer = setTimeout(() => child.kill(), 20 * 60 * 1000);
  const [out, err] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  clearTimeout(timer);
  await appendFile(log, out + err + `\n[exit ${code}]\n`);
  return code;
}

async function verify(dir: string, candidate: Candidate, log: string) {
  const pm = candidate.packageManager;
  const results: Record<string, number | 'skip'> = {};
  results.install = await run([pm, 'install'], dir, log);
  if (results.install !== 0) return results;
  const manifest = JSON.parse(
    await readFile(join(dir, 'package.json'), 'utf8')
  );
  const scripts: Record<string, string> = manifest.scripts ?? {};
  results.dbGenerate =
    facets(candidate).orm === 'prisma' && scripts['db:generate']
      ? await run([pm, 'run', 'db:generate'], dir, log)
      : 'skip';
  results.build = await run([pm, 'run', 'build'], dir, log);
  results.typecheck = scripts.typecheck
    ? await run([pm, 'run', 'typecheck'], dir, log)
    : await run(['bun', 'x', '--no-install', 'tsc', '--noEmit'], dir, log);
  results.lint = await run([pm, 'run', 'lint'], dir, log);
  return results;
}

if (import.meta.main) {
  const [outArg, ...flags] = process.argv.slice(2);
  if (!outArg)
    throw new Error(
      'Usage: bun script/verify-static.ts <outDir> [--list] [--only=c01,c02] [--keep]'
    );
  const out = resolve(outArg);
  const only = flags
    .find((flag) => flag.startsWith('--only='))
    ?.slice(7)
    .split(',');
  const cases = pairwiseCases().map((candidate, index) => ({
    name: caseName(index, candidate),
    candidate,
  }));
  if (flags.includes('--list')) {
    for (const { name, candidate } of cases)
      console.log(`${name}\t${JSON.stringify(facets(candidate))}`);
    process.exit(0);
  }
  await mkdir(out, { recursive: true });
  const summary = join(out, 'summary.tsv');
  let failures = 0;
  for (const { name, candidate } of cases) {
    if (only && !only.some((prefix) => name.startsWith(prefix))) continue;
    const dir = join(out, name);
    const log = join(out, `${name}.log`);
    await rm(dir, { recursive: true, force: true });
    await writeFile(log, `${JSON.stringify(facets(candidate))}\n`);
    await writeTree(
      dir,
      buildTree(candidate.stack, {
        projectName: 'verify-app',
        packageManager: candidate.packageManager,
      })
    );
    const started = Date.now();
    const results = await verify(dir, candidate, log);
    const failed = Object.values(results).some(
      (code) => code !== 0 && code !== 'skip'
    );
    if (failed) failures++;
    const row = [
      name,
      ...['install', 'dbGenerate', 'build', 'typecheck', 'lint'].map((step) =>
        String(results[step] ?? 'not-run')
      ),
      String(Math.round((Date.now() - started) / 1000)),
    ];
    await appendFile(summary, row.join('\t') + '\n');
    console.log(`${failed ? 'FAIL' : 'pass'} ${row.join(' ')}`);
    if (!flags.includes('--keep'))
      await rm(dir, { recursive: true, force: true });
  }
  console.log(`${failures} failing case(s); summary at ${summary}`);
  process.exit(failures === 0 ? 0 : 1);
}
