import { describe, expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { emitHono } from '#/generate/layers/hono';
import { emitNest } from '#/generate/layers/nest';
import { projectLayout } from '#/generate/layout';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

const ctx = { projectName: 'server-app', packageManager: 'pnpm' } as const;

function build(flags: RawFlags) {
  return buildTree(resolveStack(flags), ctx);
}

function loginPage(files: Record<string, string>, frontend: string) {
  return frontend === 'next'
    ? files['apps/web/app/login/page.tsx']
    : files['apps/web/src/routes/login.tsx'];
}

describe('server backend regressions', () => {
  test.each(['sqlite', 'mysql'] as const)(
    'Nest Better Auth uses the %s Prisma provider',
    (database) => {
      const files = build({
        backend: 'nest',
        database,
        orm: 'prisma',
        auth: 'better-auth',
      });
      const provider = database === 'sqlite' ? 'sqlite' : 'mysql';
      expect(files['apps/server/src/auth.ts']).toContain(
        `provider: "${provider}"`
      );
      expect(files['apps/server/src/auth.ts']).not.toContain('postgresql');
    }
  );

  test.each(['next', 'tanstack-start'] as const)(
    'Nest oRPC with auth none serves public Notes on %s',
    (frontend) => {
      const files = build({
        backend: 'nest',
        frontend,
        api: 'orpc',
        auth: 'none',
      });
      expect(files['apps/server/src/auth.ts']).toBeUndefined();
      expect(files['apps/server/package.json']).not.toContain('better-auth');
      expect(files['apps/server/src/app.module.ts']).not.toContain(
        'AuthModule'
      );
      expect(files['apps/server/src/notes.controller.ts']).not.toContain(
        'auth'
      );
      expect(files['apps/web/package.json']).not.toContain('better-auth');
    }
  );

  test.each(['next', 'tanstack-start'] as const)(
    'Hono Better Auth has a login page on %s',
    (frontend) => {
      const files = build({ backend: 'hono', frontend, auth: 'better-auth' });
      expect(loginPage(files, frontend)).toContain('LoginForm');
      expect(
        files[
          frontend === 'next'
            ? 'apps/web/components/login-form.tsx'
            : 'apps/web/src/components/login-form.tsx'
        ]
      ).toContain('authClient');
    }
  );

  test.each([
    ['next', 'none'],
    ['next', 'clerk'],
    ['tanstack-start', 'none'],
    ['tanstack-start', 'clerk'],
  ] as const)(
    'Nest oRPC on %s with auth %s has no placeholder login page',
    (frontend, auth) => {
      const files = build({ backend: 'nest', frontend, api: 'orpc', auth });
      expect(loginPage(files, frontend)).toBeUndefined();
      expect(
        Object.keys(files).some((path) => path.endsWith('auth-client.ts'))
      ).toBe(false);
    }
  );
});

const PROVIDERS = {
  prisma: { postgres: 'postgresql', sqlite: 'sqlite', mysql: 'mysql' },
  drizzle: { postgres: 'pg', sqlite: 'sqlite', mysql: 'mysql' },
} as const;

describe('server backend matrix', () => {
  const stacks: RawFlags[] = [];
  for (const backend of ['nest', 'hono'] as const)
    for (const frontend of ['next', 'tanstack-start'] as const)
      for (const api of ['orpc', 'trpc', 'none'] as const)
        for (const orm of ['prisma', 'drizzle'] as const)
          for (const database of ['postgres', 'sqlite', 'mysql'] as const)
            for (const auth of ['none', 'better-auth', 'clerk'] as const)
              for (const payments of ['none', 'stripe', 'polar'] as const) {
                if (backend === 'nest' && api === 'trpc') continue;
                const flags = {
                  backend,
                  frontend,
                  api,
                  orm,
                  database,
                  auth,
                  payments,
                };
                try {
                  resolveStack(flags);
                } catch {
                  continue;
                }
                stacks.push(flags);
              }

  test('covers both servers, frontends and auth providers', () => {
    expect(stacks.length).toBeGreaterThan(100);
  });

  test.each(stacks.map((flags) => [Object.values(flags).join(' '), flags]))(
    '%s',
    (_, flags) => {
      const files = build(flags);
      const next = flags.frontend === 'next';
      const server = JSON.parse(files['apps/server/package.json']!);
      const web = JSON.parse(files['apps/web/package.json']!);
      const betterAuth = flags.auth === 'better-auth';

      expect(Boolean(loginPage(files, flags.frontend!))).toBe(betterAuth);
      expect('better-auth' in server.dependencies).toBe(betterAuth);
      expect('better-auth' in web.dependencies).toBe(betterAuth);
      if (betterAuth)
        expect(files['apps/server/src/auth.ts']).toContain(
          `provider: "${PROVIDERS[flags.orm!][flags.database as 'postgres']}"`
        );
      else expect(files['apps/server/src/auth.ts']).toBeUndefined();

      const clerkServer =
        flags.backend === 'nest' ? '@clerk/express' : '@hono/clerk-auth';
      const clerkWeb = next ? '@clerk/nextjs' : '@clerk/tanstack-react-start';
      expect(clerkServer in server.dependencies).toBe(flags.auth === 'clerk');
      expect(clerkWeb in web.dependencies).toBe(flags.auth === 'clerk');

      expect(Boolean(files['apps/server/src/stripe.webhook.ts'])).toBe(
        flags.payments === 'stripe'
      );
      expect(
        Boolean(
          files[
            next
              ? 'apps/web/app/portal/page.tsx'
              : 'apps/web/src/routes/portal.tsx'
          ]
        )
      ).toBe(flags.payments !== 'none');
      if (flags.payments === 'polar')
        expect(files['apps/server/src/auth.ts']).toContain('polar(');
    }
  );
});

describe('server adapters', () => {
  function emit(adapter: typeof emitNest, flags: RawFlags) {
    const stack = resolveStack(flags);
    const files: Record<string, string> = {};
    adapter({
      ...ctx,
      files,
      stack,
      layout: projectLayout(stack),
      pkg: {
        name: ctx.projectName,
        private: true,
        type: 'module',
        scripts: {},
        dependencies: {},
        devDependencies: {},
      },
    });
    return files;
  }

  test.each(['orpc', 'none'] as const)('Nest mounts the %s API', (api) => {
    const files = emit(emitNest, { backend: 'nest', api, auth: 'none' });
    expect(files['apps/server/src/main.ts']).toContain('NestFactory.create');
    expect(files['apps/server/src/app.module.ts']).toContain(
      'controllers: [NotesController]'
    );
    expect(files['apps/server/src/app.module.ts'].includes('ORPCModule')).toBe(
      api === 'orpc'
    );
    expect(Boolean(files['packages/contract/src/contract.ts'])).toBe(
      api === 'orpc'
    );
  });

  test.each(['orpc', 'trpc', 'none'] as const)(
    'Hono mounts the %s API',
    (api) => {
      const files = emit(emitHono, { backend: 'hono', api, auth: 'none' });
      const entry = files['apps/server/src/index.ts'];
      expect(entry).toContain('serve(');
      if (api === 'orpc') expect(entry).toContain('new OpenAPIHandler(router)');
      if (api === 'trpc') expect(entry).toContain('"/trpc/*"');
      if (api === 'none') expect(entry).toContain('app.get("/notes"');
    }
  );

  test('both adapters share the server workspace', () => {
    const nest = emit(emitNest, { backend: 'nest', api: 'orpc' });
    const hono = emit(emitHono, { backend: 'hono', api: 'orpc' });
    for (const path of [
      '.gitignore',
      'packages/typescript-config/base.json',
      'packages/contract/src/contract.ts',
      'packages/ui/package.json',
    ])
      expect(nest[path]).toBe(hono[path]);
    expect(JSON.parse(nest['apps/server/package.json']).name).toBe('server');
    expect(JSON.parse(hono['apps/server/package.json']).name).toBe('server');
  });
});
