import type { EmitCtx } from '../../types/generate';
import type { Stack } from '../../types/stack';
import { setFile } from '../files';

type Quote = '"' | "'";

// Both adapters expose the same call heads, so transports write one Notes
// implementation and the ORM choice only changes the names they call.
export type NotesRepository = {
  importFrom(quote: Quote, dir: string, extension?: string): string;
  list: string;
  find: string;
  create: string;
  update: string;
  remove: string;
  updateMany: string;
  deleteMany: string;
};

const PRISMA_CALLS = {
  list: 'prisma.note.findMany',
  find: 'prisma.note.findFirst',
  create: 'prisma.note.create',
  update: 'prisma.note.update',
  remove: 'prisma.note.delete',
  updateMany: 'prisma.note.updateMany',
  deleteMany: 'prisma.note.deleteMany',
};

const DRIZZLE_CALLS = {
  list: 'notesStore.list',
  find: 'notesStore.find',
  create: 'notesStore.create',
  update: 'notesStore.update',
  remove: 'notesStore.remove',
  updateMany: 'notesStore.updateMany',
  deleteMany: 'notesStore.deleteMany',
};

function usesDrizzle(stack: Stack): boolean {
  return (
    stack.backend !== 'convex' &&
    stack.database !== 'none' &&
    stack.orm === 'drizzle'
  );
}

export function notesRepository(stack: Stack): NotesRepository {
  const drizzle = usesDrizzle(stack);
  return {
    ...(drizzle ? DRIZZLE_CALLS : PRISMA_CALLS),
    importFrom: (quote, dir, extension = '') =>
      drizzle
        ? `import { notesStore } from ${quote}${dir}notes-store${extension}${quote};`
        : `import { prisma } from ${quote}${dir}db${extension}${quote};`,
  };
}

// The Drizzle adapter needs a Prisma-shaped store next to the generated db client.
export function emitNotesStore(ctx: EmitCtx): void {
  const { stack } = ctx;
  if (!usesDrizzle(stack)) return;
  const server = stack.backend === 'nest' || stack.backend === 'hono';
  const lib = server
    ? 'apps/server/src/'
    : stack.frontend === 'next'
      ? 'lib/'
      : 'src/lib/';
  const extension = stack.backend === 'nest' ? '.js' : '';
  // Only Start with the built-in oRPC backend reports affected rows.
  const counted =
    stack.backend === 'self' &&
    stack.frontend === 'tanstack-start' &&
    stack.api === 'orpc';
  setFile(
    ctx.files,
    lib + 'notes-store.ts',
    `import { and, desc, eq } from "drizzle-orm";
import { db } from "./db${extension}";
import { notes } from "./schema${extension}";

type Filter = { id?: string; userId?: string };
type Input = { title: string; body: string; userId?: string };
function filter(where: Filter = {}) {
  return and(...(where.id === undefined ? [] : [eq(notes.id, where.id)]), ...(where.userId === undefined ? [] : [eq(notes.userId, where.userId)]));
}
export const notesStore = {
  async list(options: { where?: Filter; orderBy?: { createdAt: string } } = {}) {
    return db.select().from(notes).where(filter(options.where)).orderBy(desc(notes.createdAt));
  },
  async find(options: { where: Filter }) {
    return (await db.select().from(notes).where(filter(options.where)).limit(1))[0] ?? null;
  },
  async create({ data }: { data: Input }) {
    const now = new Date();
    const note = { id: crypto.randomUUID(), ...data, userId: data.userId ?? null, createdAt: now, updatedAt: now };
    await db.insert(notes).values(note);
    return note;
  },
  async update({ where, data }: { where: Filter; data: Input }) {
    await db.update(notes).set({ ...data, updatedAt: new Date() }).where(filter(where));
    const note = await this.find({ where });
    if (!note) throw new Error("NOT_FOUND");
    return note;
  },
  async remove({ where }: { where: Filter }) {
    await db.delete(notes).where(filter(where));
  },${
    counted
      ? `
  async updateMany({ where, data }: { where: Filter; data: Input }) {
    if (!(await this.find({ where }))) return { count: 0 };
    await db.update(notes).set({ ...data, updatedAt: new Date() }).where(filter(where));
    return { count: 1 };
  },
  async deleteMany({ where }: { where: Filter }) {
    if (!(await this.find({ where }))) return { count: 0 };
    await db.delete(notes).where(filter(where));
    return { count: 1 };
  },`
      : ''
  }
};
`
  );
}
