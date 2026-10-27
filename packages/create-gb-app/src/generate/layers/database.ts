import type { EmitCtx } from '../../types/generate';
import { emitDbSetup } from './db-setup';
import { emitDrizzle } from './drizzle';
import { emitPostgres } from './postgres';
import { emitPrisma } from './prisma';

export function emitDatabase(ctx: EmitCtx): void {
  const { stack } = ctx;
  if (stack.backend === 'convex' || stack.database === 'none') return;

  emitPostgres(ctx);
  switch (stack.orm) {
    case 'prisma':
      emitPrisma(ctx);
      break;
    case 'drizzle':
      emitDrizzle(ctx);
      break;
    case 'none':
      throw new Error('orm none requires database none');
    default: {
      const _exhaustive: never = stack.orm;
      throw new Error(`unhandled orm: ${_exhaustive}`);
    }
  }
  emitDbSetup(ctx);
}
