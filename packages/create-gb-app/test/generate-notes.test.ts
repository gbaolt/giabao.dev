import { expect, test } from 'bun:test';

import { buildTree, resolveStack } from '#/generate/public';
import type { RawFlags } from '#/types/stack';

function generate(flags: RawFlags) {
  return buildTree(resolveStack(flags), {
    projectName: 'notes-app',
    packageManager: 'bun',
  });
}

const notesStacks: Record<string, RawFlags> = {
  'next orpc': { api: 'orpc' },
  'next trpc': { api: 'trpc', auth: 'none' },
  'next actions': { api: 'none' },
  'start trpc': { frontend: 'tanstack-start', api: 'trpc', auth: 'none' },
  'start server functions': { frontend: 'tanstack-start', api: 'none' },
  'start orpc': { frontend: 'tanstack-start', api: 'orpc' },
  'self workspace': { structure: 'monorepo', api: 'none' },
  'nest rest': { backend: 'nest', api: 'none' },
  'nest orpc': { backend: 'nest', api: 'orpc' },
  'nest orpc clerk': { backend: 'nest', api: 'orpc', auth: 'clerk' },
  'nest start rest': {
    backend: 'nest',
    frontend: 'tanstack-start',
    api: 'none',
  },
  'hono rest': { backend: 'hono', api: 'none' },
  'hono trpc': { backend: 'hono', api: 'trpc' },
  'hono start orpc': { backend: 'hono', frontend: 'tanstack-start' },
  'convex next': { backend: 'convex', auth: 'none' },
  'convex start': { backend: 'convex', frontend: 'tanstack-start' },
};

const notesPages = [
  'app/notes/notes-client.tsx',
  'src/routes/notes.tsx',
  'apps/web/app/notes/notes-client.tsx',
  'apps/web/src/routes/notes.tsx',
];

function notesPage(files: Record<string, string>): string {
  const path = notesPages.find((candidate) => candidate in files);
  if (!path) throw new Error('missing Notes page');
  return files[path];
}

for (const [name, flags] of Object.entries(notesStacks)) {
  for (const form of ['react-hook-form', 'tanstack-form'] as const) {
    test(`${name} Notes page delegates to the ${form} NotesForm`, () => {
      const files = generate({ ...flags, form });
      const page = notesPage(files);
      expect(page).toContain('<NotesForm');
      expect(page).not.toContain('<form');
      expect(page).not.toContain('setTitle');
      expect(page).not.toContain('noteInputSchema.safeParse');
      if (page.includes('{error'))
        expect(page).toContain('const [error, setError]');
      if (page.includes('use client'))
        expect(page.trimStart()).toMatch(/^['"]use client['"];/);
    });
  }

  if (flags.backend !== 'convex') {
    test(`${name} Drizzle Notes are written against the notes store`, () => {
      const files = generate({ ...flags, orm: 'drizzle' });
      const sources = Object.entries(files).filter(([path]) =>
        /\.tsx?$/.test(path)
      );
      for (const [path, source] of sources)
        expect(`${path}: ${source.includes('prisma.note.')}`).toBe(
          `${path}: false`
        );
      expect(
        Object.keys(files).some((path) => path.endsWith('notes-store.ts'))
      ).toBe(true);
    });
  }
}

test('Start oRPC generates Drizzle Notes with counted updates', () => {
  const files = generate({
    frontend: 'tanstack-start',
    api: 'orpc',
    orm: 'drizzle',
  });
  expect(files['src/server/router.ts']).toContain('notesStore.updateMany');
  expect(files['src/server/router.ts']).toContain('notesStore.deleteMany');
  expect(files['src/lib/notes-store.ts']).toContain('async updateMany');
});

test('Notes stores outside Start oRPC omit counted updates', () => {
  const files = generate({ api: 'none', orm: 'drizzle' });
  expect(files['lib/notes-store.ts']).not.toContain('updateMany');
});

test('Next tRPC Notes use the tRPC client', () => {
  const files = generate({ api: 'trpc', auth: 'none' });
  expect(files['app/notes/notes-client.tsx']).toContain(
    'trpc.notes.list.useQuery()'
  );
  expect(files['app/notes/notes-client.tsx']).not.toContain('@/lib/orpc');
  expect(files['router.ts']).toBeUndefined();
});

test('Nest oRPC with Clerk and no database keeps the shell module', () => {
  const files = generate({
    backend: 'nest',
    api: 'orpc',
    auth: 'clerk',
    database: 'none',
  });
  expect(files['apps/server/src/app.module.ts']).not.toContain(
    'NotesController'
  );
  expect(files['apps/server/src/notes.controller.ts']).toBeUndefined();
});

test('database none with a form library writes the validation demo', () => {
  const files = generate({
    database: 'none',
    api: 'none',
    auth: 'none',
    form: 'react-hook-form',
  });
  expect(files['app/notes/page.tsx']).toContain('persistent={false}');
});
