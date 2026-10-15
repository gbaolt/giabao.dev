import { expect, test } from 'bun:test';

import { buildTree, GenerateError, resolveStack } from '#/generate/public';

const publicFlags = {
  frontend: 'tanstack-start',
  backend: 'self',
  api: 'orpc',
  auth: 'none',
  linter: 'oxlint',
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

test('Start oRPC rejects unverified variants with an actionable generation gap', () => {
  for (const flags of [
    { ...publicFlags, auth: 'clerk' },
    { ...publicFlags, form: 'react-hook-form' },
    { ...publicFlags, structure: 'turborepo' },
    { ...publicFlags, database: 'mysql' },
  ] as const) {
    expect(() =>
      buildTree(resolveStack(flags), {
        projectName: 'unsupported',
        packageManager: 'bun',
      })
    ).toThrow(GenerateError);
  }
});
