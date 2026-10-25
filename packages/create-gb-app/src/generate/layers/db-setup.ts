import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { PACKAGE_MANAGER_METADATA } from '../package-managers';
import { addReadmeSection } from '../project-model';

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
    case 'planetscale':
    case 'prisma-postgres':
    case 'neon':
    case 'supabase':
      // The database emit module writes their env entries.
      return;
    default: {
      const _exhaustive: never = setup;
      throw new Error(`unhandled db-setup: ${_exhaustive}`);
    }
  }
}

/** Connection entries a hosted database replaces the local URL with. */
export function hostedDatabaseEnv(
  stack: EmitCtx['stack'],
  dbName: string
): Record<string, string> | null {
  if (stack.backend === 'convex') return null;
  switch (stack.dbSetup) {
    case 'none':
    case 'docker':
      return null;
    case 'turso':
      return {
        TURSO_DATABASE_URL: 'libsql://DATABASE-ORGANIZATION.turso.io',
        TURSO_AUTH_TOKEN: 'YOUR_TURSO_AUTH_TOKEN',
        ...(stack.orm === 'prisma'
          ? { LOCAL_DATABASE_URL: 'file:./dev.db' }
          : {}),
      };
    case 'planetscale':
      return stack.database === 'mysql'
        ? {
            DATABASE_URL:
              stack.orm === 'prisma'
                ? 'mysql://USER:PASSWORD@HOST/DATABASE?sslaccept=strict'
                : 'mysql://USER:PASSWORD@HOST/DATABASE',
          }
        : {
            DATABASE_URL:
              'postgresql://USER:PASSWORD@HOST:6432/DATABASE?sslmode=verify-full',
            DIRECT_URL:
              'postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full',
          };
    case 'prisma-postgres':
      return {
        DATABASE_URL:
          'postgresql://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require',
        DIRECT_URL:
          'postgresql://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require',
      };
    case 'neon':
      return {
        DATABASE_URL: `postgres://USER:PASSWORD@ep-xxx.region.aws.neon.tech/${dbName}?sslmode=require`,
      };
    case 'supabase':
      return {
        DATABASE_URL: `postgres://postgres:PASSWORD@db.${dbName}.supabase.co:5432/postgres`,
      };
    default: {
      const _exhaustive: never = stack.dbSetup;
      throw new Error(`unhandled db-setup: ${_exhaustive}`);
    }
  }
}

function envOwnerPrefix(ctx: EmitCtx): string {
  return ctx.layout.envOwner ? `${ctx.layout.envOwner}/` : '';
}

export function finalizeDatabaseSetup(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex' || ctx.stack.database === 'none') return;
  appendDatabaseSetupReadme(ctx);
}

function appendDatabaseSetupReadme(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex' || ctx.stack.database === 'none') return;
  const { dbSetup, orm, database } = ctx.stack;
  const owner = envOwnerPrefix(ctx);
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
  addReadmeSection(
    ctx.project,
    'hosted-database',
    `${location}${guidance}\n\nEnvironment values are placeholders. Generation does not provision resources or test hosted connectivity.`
  );
}
