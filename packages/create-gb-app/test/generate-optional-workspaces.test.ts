import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';
import { previewTree } from '#/preview/tree';
test('optional fullstack workspaces retain web-owned server actions and shared foundations', () => {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    const files = buildTree(
      resolveStack({
        backend: 'self',
        structure: 'monorepo',
        frontend,
        api: 'none',
        database: 'sqlite',
        auth: 'none',
        addons: {
          taskRunner: 'turborepo',
        },
      }),
      { projectName: 'fullstack-workspace', packageManager: 'bun' }
    );
    expect(files['apps/web/package.json']).toBeDefined();
    expect(files['packages/ui/package.json']).toBeDefined();
    expect(files['packages/validation/package.json']).toBeDefined();
    expect(files['apps/server/package.json']).toBeUndefined();
    expect(files['apps/web/prisma/schema.prisma']).toContain(
      'provider = "sqlite"'
    );
    const sourceRoot = frontend === 'next' ? 'apps/web' : 'apps/web/src';
    expect(files[`${sourceRoot}/lib/note-validation.ts`]).toContain(
      '@repo/validation'
    );
    expect(
      files[
        frontend === 'next'
          ? 'apps/web/app/notes/actions.ts'
          : 'apps/web/src/server/notes.ts'
      ]
    ).toContain('noteInputSchema');
    expect(
      JSON.parse(files['apps/web/package.json']).scripts['db:generate']
    ).toBe('prisma generate');
    expect(JSON.parse(files['package.json']).scripts['db:generate']).toContain(
      '--filter web'
    );
  }
});
test('Convex frontend and Clerk configuration agree across both layouts', () => {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    for (const structure of ['single', 'turborepo'] as const) {
      const stack = resolveStack({
        backend: 'convex',
        frontend,
        structure,
        auth: 'clerk',
      });
      const files = buildTree(stack, {
        projectName: 'clerk-convex',
        packageManager: 'npm',
      });
      const root = structure === 'single' ? '' : 'apps/web/';
      const next = frontend === 'next';
      const provider =
        files[
          root + (next ? 'app/providers.tsx' : 'src/components/providers.tsx')
        ];
      expect(provider).toContain(next ? '@clerk/nextjs' : '@clerk/clerk-react');
      expect(provider).toContain(
        next
          ? 'process.env.NEXT_PUBLIC_CONVEX_URL'
          : 'import.meta.env.VITE_CONVEX_URL'
      );
      expect(files[root + 'convex/auth.config.ts']).toContain(
        'CLERK_JWT_ISSUER_DOMAIN'
      );
      expect(files[root + 'convex/notes.ts']).toContain('getUserIdentity');
      expect(previewTree(stack)).not.toContain('apps/server');
      expect(previewTree(stack)).not.toContain('packages/contract');
    }
  }
});
test('Convex workspaces keep native functions with their frontend and explicit codegen tasks', () => {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    const files = buildTree(
      resolveStack({
        backend: 'convex',
        structure: 'monorepo',
        frontend,
        auth: 'none',
        addons: {
          taskRunner: 'turborepo',
        },
      }),
      { projectName: 'convex-workspace', packageManager: 'pnpm' }
    );
    expect(files['apps/web/convex/schema.ts']).toBeDefined();
    expect(files['apps/web/convex/notes.ts']).toContain('@repo/validation');
    expect(files['apps/server/package.json']).toBeUndefined();
    const pkg = JSON.parse(files['apps/web/package.json']);
    expect(pkg.scripts['convex:codegen']).toBe('convex codegen');
    expect(pkg.scripts['convex:dev']).toBe('convex dev');
    expect(pkg.scripts.dev).toBe(frontend === 'next' ? 'next dev' : 'vite dev');
    expect(files['README.md']).toContain('convex:dev');
    const client =
      files[
        frontend === 'next'
          ? 'apps/web/app/notes/notes-client.tsx'
          : 'apps/web/src/routes/notes.tsx'
      ];
    expect(client).toContain('convex/_generated/api');
    expect(
      files[
        frontend === 'next'
          ? 'apps/web/app/providers.tsx'
          : 'apps/web/src/components/providers.tsx'
      ]
    ).toContain('ConvexProvider');
    expect(files['apps/web/.env.example']).toContain(
      frontend === 'next' ? 'NEXT_PUBLIC_CONVEX_URL' : 'VITE_CONVEX_URL'
    );
    expect(files['apps/web/convex/auth.config.ts']).toBeUndefined();
    expect(JSON.parse(files['package.json']).scripts.dev).toBe('turbo run dev');
  }
});
