import { expect, test } from 'bun:test';

import {
  type ArrangeFeatures,
  buildTree,
  buildTreeArranged,
} from '#/generate/build-tree';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

const ctx = { projectName: 'order-app', packageManager: 'pnpm' } as const;

const stacks: Record<string, RawFlags> = {
  'next-orpc-polar-rhf': {
    auth: 'better-auth',
    payments: 'polar',
    form: 'react-hook-form',
  },
  'next-trpc-clerk-stripe': { api: 'trpc', auth: 'clerk', payments: 'stripe' },
  'next-drizzle-turso': {
    database: 'sqlite',
    orm: 'drizzle',
    dbSetup: 'turso',
    form: 'tanstack-form',
  },
  'start-orpc-auth': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
  },
  'start-trpc-stripe': {
    frontend: 'tanstack-start',
    api: 'trpc',
    auth: 'clerk',
    payments: 'stripe',
  },
  'self-workspace-polar': {
    structure: 'monorepo',
    auth: 'better-auth',
    payments: 'polar',
    form: 'react-hook-form',
  },
  'convex-clerk': { backend: 'convex', auth: 'clerk' },
  'convex-workspace': { backend: 'convex', structure: 'monorepo' },
  'nest-polar-drizzle': {
    backend: 'nest',
    orm: 'drizzle',
    payments: 'polar',
    form: 'tanstack-form',
  },
  'hono-start-clerk-stripe': {
    backend: 'hono',
    frontend: 'tanstack-start',
    auth: 'clerk',
    payments: 'stripe',
  },
};

const rotate =
  (by: number): ArrangeFeatures =>
  (modules) =>
    modules.map((_, index) => modules[(index + by) % modules.length]!);

const arrangements: Record<string, ArrangeFeatures> = {
  reversed: (modules) => [...modules].reverse(),
  'rotated by one': rotate(1),
  'rotated by three': rotate(3),
  interleaved: (modules) => [
    ...modules.filter((_, index) => index % 2 === 1),
    ...modules.filter((_, index) => index % 2 === 0),
  ],
};

for (const [name, flags] of Object.entries(stacks)) {
  test(`feature emit modules produce the same tree in any order for ${name}`, () => {
    const stack = resolveStack(flags);
    const expected = buildTree(stack, ctx);
    for (const arrange of Object.values(arrangements))
      expect(buildTreeArranged(stack, ctx, arrange)).toEqual(expected);
  });
}
