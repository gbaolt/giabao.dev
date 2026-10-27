import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';

test('Next.js Notes action validates input with shared rules before writing', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'next',
      backend: 'self',
      api: 'none',
      auth: 'none',
    }),
    { projectName: 'validated-notes', packageManager: 'bun' }
  );

  expect(files['lib/note-validation.ts']).toContain('noteInputSchema');
  expect(files['app/notes/actions.ts']).toContain(
    'noteInputSchema.parse(input)'
  );
  expect(files['package.json']).toContain('"zod"');
});

test('TanStack Start Notes mutation derives user identity on the server', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      backend: 'self',
      api: 'none',
      auth: 'better-auth',
    }),
    { projectName: 'private-notes', packageManager: 'bun' }
  );

  const server = files['src/server/notes.ts'];
  expect(server).toContain('noteInputSchema.parse(input)');
  expect(server).toContain('auth.api.getSession');
  expect(server).not.toContain('data.userId');
});

test('Convex retains native arguments and rejects invalid Notes before insert', () => {
  const files = buildTree(
    resolveStack({ frontend: 'tanstack-start', backend: 'convex' }),
    { projectName: 'convex-notes', packageManager: 'bun' }
  );

  const mutation = files['convex/notes.ts'];
  expect(mutation).toContain('args: { title: v.string(), body: v.string() }');
  expect(mutation).toContain('noteInputSchema.parse(args)');
  expect(mutation.indexOf('noteInputSchema.parse(args)')).toBeLessThan(
    mutation.indexOf('ctx.db.insert(')
  );
});

test('Hono REST notes validate before persistence and expose shared rules', () => {
  const files = buildTree(
    resolveStack({ backend: 'hono', api: 'none', auth: 'none' }),
    { projectName: 'hono-notes', packageManager: 'pnpm' }
  );

  const store = files['apps/server/src/notes.ts'];
  expect(files['packages/validation/src/index.ts']).toContain(
    'noteInputSchema'
  );
  expect(store).toContain('noteInputSchema.parse(input)');
  expect(store.indexOf('noteInputSchema.parse(input)')).toBeLessThan(
    store.indexOf('prisma.note.create(')
  );
});

test('Notes form keeps values and reports invalid or failed submissions', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'next',
      backend: 'self',
      api: 'none',
      auth: 'none',
    }),
    { projectName: 'editable-notes', packageManager: 'bun' }
  );

  const client = files['app/notes/notes-client.tsx'];
  expect(client).toContain('noteInputSchema.safeParse');
  expect(client).toContain('role="alert"');
  expect(client).toContain('disabled={pending}');
});

test('TanStack Start Notes form reports failures and waits for successful reset', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      backend: 'self',
      api: 'none',
      auth: 'none',
    }),
    { projectName: 'start-notes', packageManager: 'bun' }
  );

  const route = files['src/routes/notes.tsx'];
  expect(route).toContain('noteInputSchema.safeParse');
  expect(route).toContain('role="alert"');
  expect(route).toContain('disabled={pending}');
});

test('Hono with TanStack Start includes the router required to build the web app', () => {
  const files = buildTree(
    resolveStack({ backend: 'hono', frontend: 'tanstack-start', api: 'none' }),
    { projectName: 'hono-start', packageManager: 'bun' }
  );

  expect(files['apps/web/src/router.tsx']).toContain('getRouter');
  expect(files['apps/web/src/router.tsx']).toContain('routeTree.gen');
});

test('Nest REST notes return validation feedback before persistence', () => {
  const files = buildTree(
    resolveStack({ backend: 'nest', api: 'none', auth: 'none' }),
    { projectName: 'nest-notes', packageManager: 'pnpm' }
  );

  const controller = files['apps/server/src/notes.controller.ts'];
  expect(controller).toContain('noteInputSchema.safeParse(input)');
  expect(controller).toContain('BadRequestException');
  expect(controller.indexOf('const note = parseNote(body)')).toBeLessThan(
    controller.indexOf('return prisma.note.create(')
  );
});

test('Zod is available even when the starter has no API or database', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'next',
      backend: 'self',
      api: 'none',
      database: 'none',
      orm: 'none',
      auth: 'none',
    }),
    { projectName: 'frontend-only', packageManager: 'npm' }
  );

  expect(files['lib/note-validation.ts']).toContain('noteInputSchema');
  expect(JSON.parse(files['package.json']).dependencies.zod).toBe('^4.1.5');
});

test('Nest Notes accepts JSON requests and builds a Node-runnable server', () => {
  const files = buildTree(
    resolveStack({ backend: 'nest', api: 'none', auth: 'none' }),
    { projectName: 'nest-runtime', packageManager: 'bun' }
  );

  expect(files['apps/server/src/main.ts']).not.toContain('bodyParser: false');
  expect(
    JSON.parse(files['apps/server/tsconfig.json']).compilerOptions
  ).toMatchObject({
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    outDir: 'dist',
  });
  expect(files['apps/server/src/main.ts']).toContain('"./app.module";');
});

test('Convex Notes form waits for saving and exposes failure feedback', () => {
  const files = buildTree(
    resolveStack({ frontend: 'tanstack-start', backend: 'convex' }),
    { projectName: 'convex-feedback', packageManager: 'bun' }
  );
  const source = files['src/routes/notes.tsx'];
  expect(source).toContain('noteInputSchema.safeParse');
  expect(source).toContain('await create(parsed.data)');
  expect(source).toContain('disabled={pending}');
  expect(source).toContain('role="alert"');
});

test('Workspace Notes HTTP clients preserve values after rejected saves', () => {
  for (const backend of ['hono', 'nest'] as const) {
    for (const frontend of ['next', 'tanstack-start'] as const) {
      const files = buildTree(
        resolveStack({ backend, frontend, api: 'none', auth: 'none' }),
        { projectName: 'http-feedback', packageManager: 'bun' }
      );
      const source =
        files[
          frontend === 'next'
            ? 'apps/web/app/notes/notes-client.tsx'
            : 'apps/web/src/routes/notes.tsx'
        ];
      expect(source).toContain('noteInputSchema.safeParse');
      expect(source).toContain('if (!response.ok)');
      expect(source).toContain('role="alert"');
      expect(source).toContain('disabled={pending}');
    }
  }
});

test('RPC Notes clients report shared validation and mutation errors', () => {
  for (const backend of ['self', 'hono', 'nest'] as const) {
    for (const frontend of ['next', 'tanstack-start'] as const) {
      const api =
        backend === 'hono' ||
        (frontend === 'tanstack-start' && backend === 'self')
          ? 'trpc'
          : 'orpc';
      const files = buildTree(
        resolveStack({ backend, frontend, api, auth: 'better-auth' }),
        { projectName: 'rpc-feedback', packageManager: 'bun' }
      );
      const root = backend === 'self' ? '' : 'apps/web/';
      const source =
        files[
          root +
            (frontend === 'next'
              ? 'app/notes/notes-client.tsx'
              : 'src/routes/notes.tsx')
        ];
      expect(source).toContain('noteInputSchema.safeParse');
      expect(source).toContain('role="alert"');
    }
  }
});

test('Authenticated Notes keeps server-owned identity alongside shared validation', () => {
  for (const frontend of ['next', 'tanstack-start'] as const) {
    for (const auth of ['better-auth', 'clerk'] as const) {
      const files = buildTree(
        resolveStack({ frontend, backend: 'self', api: 'none', auth }),
        { projectName: 'session-notes', packageManager: 'bun' }
      );
      const source =
        files[
          frontend === 'next' ? 'app/notes/actions.ts' : 'src/server/notes.ts'
        ];
      expect(source).toContain('await requireUserId()');
      expect(source).toContain('UNAUTHORIZED');
      expect(source).not.toContain('input.userId');
      expect(source).not.toContain('data.userId');
    }
  }
  for (const backend of ['hono', 'nest'] as const) {
    const files = buildTree(
      resolveStack({ backend, api: 'none', auth: 'better-auth' }),
      { projectName: 'private-workspace', packageManager: 'bun' }
    );
    const source =
      files[
        backend === 'hono'
          ? 'apps/server/src/index.ts'
          : 'apps/server/src/notes.controller.ts'
      ];
    expect(source).toContain(
      backend === 'hono' ? 'UNAUTHORIZED' : 'UnauthorizedException'
    );
    expect(source).not.toContain('body.userId');
  }
});
