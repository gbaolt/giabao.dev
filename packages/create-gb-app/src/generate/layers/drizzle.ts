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
