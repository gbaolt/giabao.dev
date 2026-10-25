import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';

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
  const authLines =
    ctx.stack.auth === 'better-auth'
      ? `BETTER_AUTH_SECRET="dev-secret-change-me-please-32chars"
BETTER_AUTH_URL="${ctx.layout.structure === 'monorepo' ? 'http://localhost:3333' : 'http://localhost:3000'}"
`
      : ctx.stack.auth === 'clerk'
        ? `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
`
        : '';
  const nestLines = ctx.layout.structure === 'monorepo'
    ? `NEXT_PUBLIC_SERVER_URL="http://localhost:3333"
${
  ctx.stack.frontend === 'tanstack-start'
    ? `VITE_SERVER_URL="http://localhost:3333"
`
    : ''
}`
    : '';
  const env = `DATABASE_URL="${databaseUrl}"
${authLines}${nestLines}`;
  setFile(ctx.files, '.env', env);
  setFile(ctx.files, '.env.example', env);
}
