import { expect, test } from 'bun:test';

import {
  buildTree,
  CompatError,
  GenerateError,
  resolveStack,
} from '#/generate/public';
import type { RawFlags } from '#/types/stack';

const axes = {
  frontend: ['next', 'tanstack-start'],
  backend: ['self', 'nest', 'convex', 'hono'],
  structure: ['single', 'monorepo'],
  api: ['orpc', 'trpc', 'none'],
  database: ['postgres', 'sqlite', 'mysql', 'none'],
  orm: ['prisma', 'drizzle', 'none'],
  auth: ['better-auth', 'clerk', 'none'],
  payments: ['none', 'stripe', 'polar'],
  form: ['none', 'react-hook-form'],
} as const;

function* stacks(): Generator<RawFlags> {
  let combos: Record<string, string>[] = [{}];
  for (const [axis, values] of Object.entries(axes))
    combos = combos.flatMap((combo) =>
      values.map((value) => ({ ...combo, [axis]: value }))
    );
  for (const { form, ...flags } of combos) {
    const raw: Record<string, unknown> = { ...flags, addons: { form } };
    if (flags.backend === 'convex') {
      if (['api', 'database', 'orm'].some((key) => flags[key] !== 'none'))
        continue;
      for (const key of ['api', 'database', 'orm']) delete raw[key];
    }
    yield raw as RawFlags;
  }
}

const SPECIFIER =
  /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+|\brequire\s*\(\s*)(["'])([^"']+)\1/gm;

test('no generated module imports another module by file extension', () => {
  const offenders = new Set<string>();
  let generated = 0;
  for (const raw of stacks()) {
    let files;
    try {
      files = buildTree(resolveStack(raw), {
        projectName: 'import-app',
        packageManager: 'bun',
      });
    } catch (error) {
      if (error instanceof CompatError || error instanceof GenerateError)
        continue;
      throw error;
    }
    generated++;
    for (const [path, source] of Object.entries(files)) {
      if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
      for (const [, , specifier] of source.matchAll(SPECIFIER))
        if (/\.[cm]?[jt]sx?$/.test(specifier!))
          offenders.add(`${path} -> ${specifier}`);
    }
  }
  expect(generated).toBeGreaterThan(500);
  expect([...offenders]).toEqual([]);
}, 60_000);
