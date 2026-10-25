import type { EmitCtx } from '../../types/generate';
import { addEnv } from '../project-model';
import { hostedDatabaseEnv } from './db-setup';

export function emitPostgres(ctx: EmitCtx): void {
  const dbName = ctx.projectName.replace(/[^a-zA-Z0-9_]/g, '_') || 'app';
  const databaseUrl =
    ctx.stack.backend === 'convex'
      ? ''
      : ctx.stack.database === 'sqlite'
        ? `file:./dev.db`
        : ctx.stack.database === 'mysql'
          ? `mysql://root:root@localhost:3306/${dbName}`
          : `postgres://postgres:postgres@localhost:5432/${dbName}`;
  addEnv(
    ctx.project,
    hostedDatabaseEnv(ctx.stack, dbName) ?? { DATABASE_URL: databaseUrl }
  );
  if (ctx.stack.auth === 'better-auth')
    addEnv(ctx.project, {
      BETTER_AUTH_SECRET: 'dev-secret-change-me-please-32chars',
      BETTER_AUTH_URL:
        ctx.layout.structure === 'monorepo'
          ? 'http://localhost:3333'
          : 'http://localhost:3000',
    });
  else if (ctx.stack.auth === 'clerk')
    addEnv(ctx.project, {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_replace_me',
      CLERK_SECRET_KEY: 'sk_test_replace_me',
    });
  if (ctx.layout.structure === 'monorepo') {
    addEnv(ctx.project, { NEXT_PUBLIC_SERVER_URL: 'http://localhost:3333' });
    if (ctx.stack.frontend === 'tanstack-start')
      addEnv(ctx.project, { VITE_SERVER_URL: 'http://localhost:3333' });
  }
}
