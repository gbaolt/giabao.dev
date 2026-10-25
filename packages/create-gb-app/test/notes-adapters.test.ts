import { expect, test } from 'bun:test';

import { projectLayout } from '#/generate/layout';
import { notesForm, restCreate } from '#/generate/notes/form';
import { emitNotesStore, notesRepository } from '#/generate/notes/repository';
import { resolveStack } from '#/stack/resolve';
import type { EmitCtx } from '#/types/generate';
import type { RawFlags } from '#/types/stack';

function context(flags: RawFlags): EmitCtx {
  const stack = resolveStack(flags);
  return {
    projectName: 'adapter-app',
    packageManager: 'bun',
    files: {},
    pkg: {
      name: 'adapter-app',
      private: true,
      type: 'module',
      scripts: {},
      dependencies: {},
      devDependencies: {},
    },
    stack,
    layout: projectLayout(stack),
  };
}

test('Prisma repository calls the Prisma client', () => {
  const repo = notesRepository(resolveStack({ orm: 'prisma' }));
  expect(repo.list).toBe('prisma.note.findMany');
  expect(repo.remove).toBe('prisma.note.delete');
  expect(repo.importFrom('"', './', '.js')).toBe(
    'import { prisma } from "./db.js";'
  );
});

test('Drizzle repository calls the notes store', () => {
  const repo = notesRepository(resolveStack({ orm: 'drizzle' }));
  expect(repo.list).toBe('notesStore.list');
  expect(repo.find).toBe('notesStore.find');
  expect(repo.importFrom("'", '@/lib/')).toBe(
    "import { notesStore } from '@/lib/notes-store';"
  );
});

test('notes store is only written for Drizzle', () => {
  const prisma = context({ orm: 'prisma' });
  emitNotesStore(prisma);
  expect(prisma.files).toEqual({});

  const convex = context({ backend: 'convex' });
  emitNotesStore(convex);
  expect(convex.files).toEqual({});
});

for (const [backend, path, db] of [
  ['self', 'lib/notes-store.ts', '"./db"'],
  ['nest', 'apps/server/src/notes-store.ts', '"./db.js"'],
  ['hono', 'apps/server/src/notes-store.ts', '"./db"'],
] as const) {
  test(`${backend} notes store sits next to its db client`, () => {
    const ctx = context({ backend, orm: 'drizzle' });
    emitNotesStore(ctx);
    expect(ctx.files[path]).toContain(`import { db } from ${db}`);
  });
}

test('inline form keeps the page form and imports nothing', () => {
  const form = notesForm(resolveStack({ form: 'none' }));
  expect(form.inline).toBe(true);
  expect(form.importLine('"')).toBe('');
});

test('form library delegates submission to NotesForm', () => {
  const form = notesForm(resolveStack({ form: 'react-hook-form' }));
  expect(form.inline).toBe(false);
  expect(form.importLine("'", '../components/notes-form')).toBe(
    "\nimport { NotesForm } from '../components/notes-form';"
  );
  const element = form.element(['await save(input);', 'await reload();']);
  expect(element).toContain('<NotesForm');
  expect(element).toContain('await save(input);\n          await reload();');
});

test('REST submission throws the server validation message', () => {
  const statements = restCreate('/notes', false).join('\n');
  expect(statements).toContain('JSON.stringify(input)');
  expect(statements).toContain('throw new Error(');
  expect(statements).not.toContain('setNotes');
  expect(restCreate('/notes', true).join('\n')).toContain('setNotes');
});
