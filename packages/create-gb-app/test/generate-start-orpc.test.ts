import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';
const publicFlags = {
  frontend: 'tanstack-start',
  backend: 'self',
  api: 'orpc',
  auth: 'none',
  addons: {
    linting: 'oxlint',
  },
} as const;
test('public Start oRPC emits a native fullstack Notes application', () => {
  const files = buildTree(resolveStack(publicFlags), {
    projectName: 'start-notes',
    packageManager: 'bun',
  });
  expect(files['src/routes/api/rpc.$.ts']).toContain('/api/rpc');
  expect(files['src/server/router.ts']).toContain('notes:');
  expect(files['src/server/router.ts']).not.toContain('auth.api');
  expect(files['src/routes/notes.tsx']).toContain('Edit');
  expect(files['src/routes/notes.tsx']).toContain('Delete');
  expect(files['src/router.tsx']).toContain('setupRouterSsrQueryIntegration');
  expect(files['src/lib/orpc.ts']).toContain('createRouterClient');
  expect(files['app/providers.tsx']).toBeUndefined();
  expect(files['router.ts']).toBeUndefined();
  expect(Object.values(files).join('\n')).not.toContain('next/headers');
  const manifest = JSON.parse(files['package.json']);
  expect(
    manifest.dependencies['@tanstack/react-router-ssr-query']
  ).toBeDefined();
  expect(
    manifest.dependencies['@tanstack/react-query-next-experimental']
  ).toBeUndefined();
});
test('private Start oRPC includes a complete Better Auth flow and ownership constraints', () => {
  const files = buildTree(
    resolveStack({ ...publicFlags, auth: 'better-auth' }),
    { projectName: 'private-notes', packageManager: 'bun' }
  );
  expect(files['src/routes/api/auth.$.ts']).toContain('auth.handler(request)');
  expect(files['src/routes/login.tsx']).toContain('LoginForm');
  expect(files['src/components/login-form.tsx']).toContain(
    'authClient.signUp.email'
  );
  expect(files['src/server/router.ts']).toContain('auth.api.getSession');
  expect(files['src/server/router.ts']).toContain('userId: context.user.id');
  expect(files['src/routes/notes.tsx']).toContain('Sign out');
  expect(files['src/routes/notes.tsx']).toContain('private, no-store');
});
test('Start oRPC rejects unverified variants before generation', () => {
  for (const flags of [
    { ...publicFlags, auth: 'clerk' },
    { ...publicFlags, database: 'mysql' },
  ] as const) {
    expect(() => resolveStack(flags)).toThrow('(start-orpc-limits)');
  }
});
for (const form of ['react-hook-form', 'tanstack-form'] as const) {
  for (const auth of ['none', 'better-auth'] as const) {
    test(`Start oRPC composes ${form} with ${auth} without rewriting the Notes mutations`, () => {
      const files = buildTree(resolveStack({ ...publicFlags, auth, form }), {
        projectName: 'form-notes',
        packageManager: 'bun',
      });
      const route = files['src/routes/notes.tsx'];
      expect(route).toContain('<NotesForm');
      expect(route).toContain('onSubmit={saveNote}');
      expect(route).toContain('update.mutateAsync');
      expect(route).toContain('remove.mutate');
      expect(files['src/components/notes-form.tsx']).toContain('defaultValues');
      const manifest = JSON.parse(files['package.json']);
      expect(Boolean(manifest.dependencies['react-hook-form'])).toBe(
        form === 'react-hook-form'
      );
      expect(Boolean(manifest.dependencies['@tanstack/react-form'])).toBe(
        form === 'tanstack-form'
      );
    });
  }
}
for (const packageManager of ['bun', 'npm', 'pnpm', 'yarn'] as const) {
  for (const auth of ['none', 'better-auth'] as const) {
    test(`Start oRPC ${auth} workspaces retain web ownership with ${packageManager}`, () => {
      const files = buildTree(
        resolveStack({
          ...publicFlags,
          auth,
          structure: 'monorepo',
          addons: {
            taskRunner: 'turborepo',
          },
        }),
        { projectName: 'workspace-notes', packageManager }
      );
      expect(files['apps/web/src/routes/api/rpc.$.ts']).toBeDefined();
      expect(files['apps/web/src/server/router.ts']).toBeDefined();
      expect(files['apps/web/prisma/schema.prisma']).toBeDefined();
      expect(files['apps/server/package.json']).toBeUndefined();
      expect(files['apps/web/src/lib/note-validation.ts']).toContain(
        '@repo/validation'
      );
      const web = JSON.parse(files['apps/web/package.json']);
      expect(web.dependencies.zod).toBeDefined();
      expect(web.dependencies['@repo/validation']).toBe(
        packageManager === 'npm' ? '*' : 'workspace:*'
      );
      const turbo = JSON.parse(files['turbo.json']);
      expect(turbo.globalEnv).toContain('DATABASE_URL');
      if (auth === 'better-auth') {
        expect(turbo.globalEnv).toContain('BETTER_AUTH_SECRET');
        expect(turbo.globalEnv).toContain('BETTER_AUTH_URL');
      }
      expect(turbo.tasks['db:push'].cache).toBe(false);
      if (packageManager === 'bun')
        expect(files['bunfig.toml']).toContain('linker = "hoisted"');
    });
  }
}
test('Start oRPC keeps unverified workspace and form-library combinations gated', () => {
  for (const form of ['react-hook-form', 'tanstack-form'] as const) {
    expect(() =>
      resolveStack({
        ...publicFlags,
        form,
        structure: 'monorepo',
        addons: {
          taskRunner: 'turborepo',
        },
      })
    ).toThrow('(start-orpc-limits)');
  }
});
