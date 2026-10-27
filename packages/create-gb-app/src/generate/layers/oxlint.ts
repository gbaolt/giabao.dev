import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitOxlint(ctx: EmitCtx): void {
  ctx.pkg.scripts.lint = 'oxlint .';
  ctx.pkg.devDependencies.oxlint = DEPENDENCY_VERSIONS['oxlint'];

  const nextRoot =
    ctx.stack.frontend === 'next'
      ? { next: { rootDir: ctx.layout.frontendRoot || '.' } }
      : {};

  setFile(
    ctx.files,
    '.oxlintrc.json',
    JSON.stringify(
      {
        $schema: './node_modules/oxlint/configuration_schema.json',
        plugins: ['typescript', 'react', 'unicorn'],
        ...(Object.keys(nextRoot).length > 0 ? { settings: nextRoot } : {}),
      },
      null,
      2
    )
  );
}
