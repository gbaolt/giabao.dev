import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { isAppsLayout, joinPath, libDir } from '../paths';

export function emitDrizzle(ctx: EmitCtx): void {
  ctx.pkg.dependencies['drizzle-orm'] = DEPENDENCY_VERSIONS['drizzle-orm'];
  ctx.pkg.devDependencies['drizzle-kit'] = DEPENDENCY_VERSIONS['drizzle-kit'];
  ctx.pkg.scripts['db:generate'] = 'drizzle-kit generate';
  ctx.pkg.scripts['db:push'] = 'drizzle-kit push';
  const turso = ctx.stack.backend !== 'convex' && ctx.stack.dbSetup === 'turso';
  const planetscaleMysql =
    ctx.stack.backend !== 'convex' &&
    ctx.stack.dbSetup === 'planetscale' &&
    ctx.stack.database === 'mysql';
  const direct =
    ctx.stack.backend !== 'convex' &&
    ctx.stack.database === 'postgres' &&
    (ctx.stack.dbSetup === 'planetscale' ||
      ctx.stack.dbSetup === 'prisma-postgres');
  ctx.pkg.devDependencies.dotenv = DEPENDENCY_VERSIONS.dotenv;
  if (turso) ctx.pkg.scripts['db:migrate'] = 'drizzle-kit migrate';

  const schemaPath = isAppsLayout(ctx.stack)
    ? 'apps/server/src/schema.ts'
    : joinPath(libDir(ctx.stack), 'schema.ts');
  const clientPath = isAppsLayout(ctx.stack)
    ? 'apps/server/src/db.ts'
    : joinPath(libDir(ctx.stack), 'db.ts');
  const driver =
    ctx.stack.backend === 'convex'
      ? 'postgresql'
      : ctx.stack.backend === 'self' ||
          ctx.stack.backend === 'nest' ||
          ctx.stack.backend === 'hono'
        ? ctx.stack.database
        : 'postgres';

  if (turso) {
    ctx.pkg.dependencies['@libsql/client'] =
      DEPENDENCY_VERSIONS['@libsql/client'];
  } else if (driver === 'sqlite') {
    ctx.pkg.dependencies['better-sqlite3'] =
      DEPENDENCY_VERSIONS['better-sqlite3'];
  } else if (driver === 'mysql') {
    ctx.pkg.dependencies.mysql2 = DEPENDENCY_VERSIONS['mysql2'];
  } else {
    ctx.pkg.dependencies.pg = DEPENDENCY_VERSIONS['pg'];
  }

  const table =
    driver === 'sqlite'
      ? 'sqliteTable'
      : driver === 'mysql'
        ? 'mysqlTable'
        : 'pgTable';
  const key = (name: string) =>
    driver === 'mysql'
      ? `varchar("${name}", { length: 191 })`
      : `text("${name}")`;
  const date = (name: string) =>
    driver === 'sqlite'
      ? `integer("${name}", { mode: "timestamp" })`
      : `timestamp("${name}")`;
  const bool = (name: string) =>
    driver === 'sqlite'
      ? `integer("${name}", { mode: "boolean" })`
      : `boolean("${name}")`;
  const auth = ctx.stack.auth === 'better-auth';
  const authSchema = auth
    ? `
export const user = ${table}("user", {
  id: ${key('id')}.primaryKey(), name: text("name").notNull(), email: ${key('email')}.notNull().unique(),
  emailVerified: ${bool('email_verified')}.notNull(), image: text("image"),
  createdAt: ${date('created_at')}.notNull(), updatedAt: ${date('updated_at')}.notNull(),
});
export const session = ${table}("session", {
  id: ${key('id')}.primaryKey(), expiresAt: ${date('expires_at')}.notNull(), token: ${key('token')}.notNull().unique(),
  createdAt: ${date('created_at')}.notNull(), updatedAt: ${date('updated_at')}.notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: ${key('user_id')}.notNull().references(() => user.id, { onDelete: "cascade" }),
});
export const account = ${table}("account", {
  id: ${key('id')}.primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: ${key('user_id')}.notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: ${date('access_token_expires_at')}, refreshTokenExpiresAt: ${date('refresh_token_expires_at')},
  scope: text("scope"), password: text("password"), createdAt: ${date('created_at')}.notNull(), updatedAt: ${date('updated_at')}.notNull(),
});
export const verification = ${table}("verification", {
  id: ${key('id')}.primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: ${date('expires_at')}.notNull(), createdAt: ${date('created_at')}, updatedAt: ${date('updated_at')},
});
`
    : '';
  setFile(
    ctx.files,
    schemaPath,
    `import { ${table}, text, ${driver === 'sqlite' ? 'integer' : driver === 'mysql' ? 'varchar, timestamp, boolean' : 'timestamp, boolean'} } from "drizzle-orm/${driver === 'sqlite' ? 'sqlite-core' : driver === 'mysql' ? 'mysql-core' : 'pg-core'}";
${authSchema}
export const notes = ${table}("notes", {
  id: ${key('id')}.primaryKey(), title: text("title").notNull(), body: text("body").notNull(),
  createdAt: ${date('created_at')}.notNull().$defaultFn(() => new Date()), updatedAt: ${date('updated_at')}.notNull().$defaultFn(() => new Date()),
  userId: ${key('user_id')}${auth ? '.references(() => user.id, { onDelete: "cascade" })' : ''},
});
`
  );

  setFile(
    ctx.files,
    clientPath,
    `import { drizzle } from "drizzle-orm/${turso ? 'libsql' : driver === 'sqlite' ? 'better-sqlite3' : driver === 'mysql' ? 'mysql2' : 'node-postgres'}";
${turso ? 'import { createClient } from "@libsql/client";\n' : planetscaleMysql ? 'import { createPool } from "mysql2/promise";\n' : ''}import * as schema from "./schema${ctx.stack.backend === 'nest' ? '.js' : ''}";

${turso ? 'const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });\n\nexport const db = drizzle(client, { schema });' : planetscaleMysql ? 'const pool = createPool({ uri: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: true } });\n\nexport const db = drizzle(pool, { schema, mode: "default" });' : 'export const db = drizzle(process.env.DATABASE_URL as string, { schema });'}
`
  );

  setFile(
    ctx.files,
    isAppsLayout(ctx.stack)
      ? 'apps/server/drizzle.config.ts'
      : 'drizzle.config.ts',
    `import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "${isAppsLayout(ctx.stack) ? '../../.env' : '.env'}" });

${planetscaleMysql ? 'const connection = new URL(process.env.DATABASE_URL!);\n' : ''}
export default defineConfig({
  schema: "./${isAppsLayout(ctx.stack) ? 'src/schema.ts' : schemaPath}",
  out: "./drizzle",
  dialect: "${turso ? 'turso' : driver === 'sqlite' ? 'sqlite' : driver === 'mysql' ? 'mysql' : 'postgresql'}",
  dbCredentials: ${turso ? '{ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! }' : planetscaleMysql ? '{ host: connection.hostname, port: Number(connection.port || 3306), user: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password), database: connection.pathname.slice(1), ssl: { rejectUnauthorized: true } }' : `{ url: process.env.${direct ? 'DIRECT_URL' : 'DATABASE_URL'} as string }`},
});
`
  );
}

export function emitDrizzleNotesRepository(ctx: EmitCtx): void {
  if (
    ctx.stack.backend === 'convex' ||
    ctx.stack.orm !== 'drizzle' ||
    ctx.stack.database === 'none'
  )
    return;
  const root =
    ctx.stack.backend !== 'self'
      ? 'apps/server/'
      : ctx.stack.structure === 'monorepo'
        ? 'apps/web/'
        : '';
  const lib =
    root +
    (ctx.stack.backend !== 'self'
      ? 'src/'
      : ctx.stack.frontend === 'next'
        ? 'lib/'
        : 'src/lib/');
  if (ctx.stack.backend === 'hono') {
    const authed = ctx.stack.auth !== 'none';
    setFile(
      ctx.files,
      lib + 'notes.ts',
      `import { noteInputSchema } from "@repo/validation";
import { notesStore } from "./notes-store";
function scope(userId: string | null) {
  ${authed ? 'if (!userId) throw new Error("UNAUTHORIZED"); return { userId };' : 'return {};'}
}
export async function listNotes(userId: string | null) {
  return notesStore.list({ where: scope(userId) });
}
export async function createNote(userId: string | null, input: { title: string; body: string }) {
  const user = scope(userId);
  const note = noteInputSchema.parse(input);
  return notesStore.create({ data: { ...note, ...user } });
}
export async function updateNote(userId: string | null, input: { id: string; title: string; body: string }) {
  const where = { id: input.id, ...scope(userId) };
  if (!await notesStore.find({ where })) throw new Error("NOT_FOUND");
  return notesStore.update({ where, data: noteInputSchema.parse(input) });
}
export async function removeNote(userId: string | null, id: string): Promise<{ ok: true }> {
  const where = { id, ...scope(userId) };
  if (!await notesStore.find({ where })) throw new Error("NOT_FOUND");
  await notesStore.remove({ where });
  return { ok: true };
}
`
    );
  }
  for (const [path, source] of Object.entries(ctx.files)) {
    if (
      !path.startsWith(root) ||
      !/\.tsx?$/.test(path) ||
      !source.includes('prisma.note.')
    )
      continue;
    let next = source.replace(
      /import \{ prisma \} from (["'])([^"']*?)db(\.js)?\1;/g,
      'import { notesStore } from $1$2notes-store$3$1;'
    );
    for (const [oldName, newName] of Object.entries({
      findMany: 'list',
      findFirst: 'find',
      create: 'create',
      update: 'update',
      delete: 'remove',
    })) {
      next = next.replaceAll(`prisma.note.${oldName}`, `notesStore.${newName}`);
    }
    setFile(ctx.files, path, next);
  }
  setFile(
    ctx.files,
    lib + 'notes-store.ts',
    `import { and, desc, eq } from "drizzle-orm";
import { db } from "./db${ctx.stack.backend === 'nest' ? '.js' : ''}";
import { notes } from "./schema${ctx.stack.backend === 'nest' ? '.js' : ''}";

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
  },
};
`
  );
}
