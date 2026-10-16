import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { PACKAGE_MANAGER_METADATA } from '../package-managers';
import { emitDrizzleNotesRepository } from './drizzle';

export function emitDbSetup(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex') {
    return;
  }
  const setup = ctx.stack.dbSetup;
  const database = ctx.stack.database;
  const dbName = ctx.projectName.replace(/[^a-zA-Z0-9_]/g, '_') || 'app';

  switch (setup) {
    case 'none':
      return;
    case 'docker': {
      if (database === 'sqlite') {
        throw new Error('sqlite docker is forbidden');
      }
      const service =
        database === 'mysql'
          ? `mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: ${dbName}
    ports:
      - "3306:3306"
`
          : `postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${dbName}
    ports:
      - "5432:5432"
`;
      setFile(
        ctx.files,
        'docker-compose.yml',
        `services:
  ${service}`
      );
      return;
    }
    case 'turso':
      patchEnv(
        ctx,
        `TURSO_DATABASE_URL="libsql://DATABASE-ORGANIZATION.turso.io"
TURSO_AUTH_TOKEN="YOUR_TURSO_AUTH_TOKEN"${ctx.stack.orm === 'prisma' ? '\nLOCAL_DATABASE_URL="file:./dev.db"' : ''}`
      );
      return;
    case 'planetscale':
      patchEnv(
        ctx,
        database === 'mysql'
          ? ctx.stack.orm === 'prisma'
            ? 'DATABASE_URL="mysql://USER:PASSWORD@HOST/DATABASE?sslaccept=strict"'
            : 'DATABASE_URL="mysql://USER:PASSWORD@HOST/DATABASE"'
          : 'DATABASE_URL="postgresql://USER:PASSWORD@HOST:6432/DATABASE?sslmode=verify-full"\nDIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full"'
      );
      return;
    case 'prisma-postgres':
      patchEnv(
        ctx,
        'DATABASE_URL="postgresql://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require"\nDIRECT_URL="postgresql://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"'
      );
      return;
    case 'neon':
      patchEnv(
        ctx,
        `DATABASE_URL="postgres://USER:PASSWORD@ep-xxx.region.aws.neon.tech/${dbName}?sslmode=require"`
      );
      return;
    case 'supabase':
      patchEnv(
        ctx,
        `DATABASE_URL="postgres://postgres:PASSWORD@db.${dbName}.supabase.co:5432/postgres"`
      );
      return;
    default: {
      const _exhaustive: never = setup;
      throw new Error(`unhandled db-setup: ${_exhaustive}`);
    }
  }
}

function patchEnv(ctx: EmitCtx, databaseUrlLine: string): void {
  const current = ctx.files['.env'] ?? '';
  const next = current.includes('DATABASE_URL=')
    ? current.replace(/DATABASE_URL=".*"/, databaseUrlLine)
    : `${databaseUrlLine}\n${current}`;
  setFile(ctx.files, '.env', next);
  setFile(ctx.files, '.env.example', next);
}

export function finalizeDatabaseSetup(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex' || ctx.stack.database === 'none') return;
  emitDrizzleNotesRepository(ctx);
  finalizeServerDatabase(ctx);
  appendDatabaseSetupReadme(ctx);
}

function finalizeServerDatabase(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex' || ctx.stack.database === 'none') return;
  const { dbSetup, orm, database, backend, structure } = ctx.stack;
  const server = backend === 'nest' || backend === 'hono';
  const owner =
    structure === 'single' ? '' : server ? 'apps/server/' : 'apps/web/';
  if (!server) return;

  const manifest = JSON.parse(ctx.files['apps/server/package.json']);
  manifest.scripts ??= {};
  manifest.dependencies ??= {};
  manifest.devDependencies ??= {};
  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const name of [
      '@prisma/client',
      '@prisma/adapter-libsql',
      '@libsql/client',
      'prisma',
      'drizzle-orm',
      'drizzle-kit',
      'dotenv',
      'pg',
      'mysql2',
      'better-sqlite3',
    ]) {
      const version = ctx.pkg[section][name];
      if (version) {
        manifest[section][name] = version;
        delete ctx.pkg[section][name];
      }
    }
  }

  for (const [name, command] of Object.entries(ctx.pkg.scripts)) {
    if (!name.startsWith('db:')) continue;
    manifest.scripts[name] = command;
    delete ctx.pkg.scripts[name];
  }
  if (dbSetup === 'turso' && orm === 'prisma')
    delete manifest.scripts['db:push'];
  if (orm === 'drizzle') {
    delete manifest.dependencies['@prisma/client'];
    delete manifest.devDependencies.prisma;
    const authPath = 'apps/server/src/auth.ts';
    const source = ctx.files[authPath];
    if (source) {
      const provider =
        database === 'sqlite'
          ? 'sqlite'
          : database === 'mysql'
            ? 'mysql'
            : 'pg';
      setFile(
        ctx.files,
        authPath,
        source
          .replace('prismaAdapter', 'drizzleAdapter')
          .replace('prismaAdapter', 'drizzleAdapter')
          .replace(
            'better-auth/adapters/prisma',
            'better-auth/adapters/drizzle'
          )
          .replace(
            /import \{ prisma \} from (["'])\.\/db(\.js)?\1;/,
            'import { db } from $1./db$2$1;\nimport * as schema from $1./schema$2$1;'
          )
          .replace(
            /drizzleAdapter\((?:prisma|db), \{ provider: "[^"]+" \}\)/,
            `drizzleAdapter(db, { schema, provider: "${provider}" })`
          )
      );
    }
  }
  setFile(
    ctx.files,
    'apps/server/package.json',
    JSON.stringify(manifest, null, 2)
  );
  for (const name of ['.env', '.env.example']) {
    const source = ctx.files[name];
    setFile(ctx.files, owner + name, source);
    const publicValues = source
      .split('\n')
      .filter((line) => /^(NEXT_PUBLIC_|VITE_)/.test(line))
      .join('\n');
    if (publicValues)
      setFile(ctx.files, 'apps/web/' + name, publicValues + '\n');
    delete ctx.files[name];
  }
  if (orm === 'drizzle')
    setFile(
      ctx.files,
      owner + 'drizzle.config.ts',
      ctx.files[owner + 'drizzle.config.ts'].replace('"../../.env"', '".env"')
    );
  for (const [path, source] of Object.entries(ctx.files)) {
    if (!path.startsWith('apps/server/src/') || !path.endsWith('.ts')) continue;
    setFile(
      ctx.files,
      path,
      source.replace(
        /from (["'])(\.[^"']+)\1/g,
        (match, quote: string, specifier: string) =>
          /\.[a-z]+$/.test(specifier)
            ? match
            : `from ${quote}${specifier}.js${quote}`
      )
    );
  }
}

function appendDatabaseSetupReadme(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex' || ctx.stack.database === 'none') return;
  const { dbSetup, orm, database, backend, structure } = ctx.stack;
  const server = backend === 'nest' || backend === 'hono';
  const owner =
    structure === 'single' ? '' : server ? 'apps/server/' : 'apps/web/';
  if (!['turso', 'planetscale', 'prisma-postgres'].includes(dbSetup)) return;
  const run = PACKAGE_MANAGER_METADATA[ctx.packageManager].run;
  const location = owner
    ? `Run schema commands from ${owner.slice(0, -1)}; return to the project root before running dev. `
    : 'Run commands from the project root. ';
  let guidance: string;
  if (dbSetup === 'turso') {
    guidance =
      'Copy your existing database URL and token into TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in ' +
      owner +
      '.env. ';
    guidance +=
      orm === 'prisma'
        ? `Keep LOCAL_DATABASE_URL=file:./dev.db for Prisma 6 schema tooling (relative to prisma/schema.prisma). Run ${run} db:generate and ${run} db:migrate to create a local SQLite migration. Review its SQL, then apply it with the Turso CLI: turso db shell <database> < prisma/migrations/<migration>/migration.sql (PowerShell: Get-Content prisma/migrations/<migration>/migration.sql | turso db shell <database>). Apply each migration once; the remote database does not use Prisma's migration history. Do not run Prisma db push against Turso.`
        : `Run ${run} db:generate, review the generated SQL, then ${run} db:migrate to apply migrations with libSQL authentication. ${run} db:push is available for development prototyping.`;
  } else if (database === 'mysql') {
    guidance = `Use the PlanetScale Connect screen's TCP URL for a development branch as DATABASE_URL in ${owner}.env. Enable foreign key support for the generated relation models. This starter uses the normal MySQL TCP driver, not the HTTP transport. Run ${orm === 'prisma' ? `${run} db:generate and ` : ''}${run} db:push on the development branch, then open a PlanetScale deploy request to promote schema changes. Do not apply DDL directly to a protected production branch.`;
  } else {
    guidance = `Copy the provider's pooled application connection into DATABASE_URL and direct schema connection into DIRECT_URL in ${owner}.env. Preserve TLS parameters from the Connect screen. The runtime uses the pooled URL; ${orm === 'prisma' ? 'Prisma 6 directUrl' : 'Drizzle Kit'} uses DIRECT_URL for schema changes. Run ${orm === 'prisma' ? `${run} db:generate and ` : ''}${run} db:push to apply the schema.`;
  }
  setFile(
    ctx.files,
    'README.md',
    (ctx.files['README.md'] ??
      `# ${ctx.projectName}\n\nGenerated by create-gb-app.\n`) +
      `\n## Database setup\n\n${location}${guidance}\n\nEnvironment values are placeholders. Generation does not provision resources or test hosted connectivity.\n`
  );
}
