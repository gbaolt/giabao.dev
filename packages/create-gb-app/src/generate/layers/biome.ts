import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitBiome(ctx: EmitCtx): void {
  ctx.pkg.scripts.lint = 'biome lint .';
  ctx.pkg.devDependencies['@biomejs/biome'] =
    DEPENDENCY_VERSIONS['@biomejs/biome'];

  const nestDecorators = ctx.stack.backend === 'nest';

  setFile(
    ctx.files,
    'biome.json',
    JSON.stringify(
      {
        $schema: './node_modules/@biomejs/biome/configuration_schema.json',
        // Build output and framework-generated files are not source.
        files: {
          includes: [
            '**',
            '!**/node_modules',
            '!**/dist',
            '!**/.next',
            '!**/.output',
            '!**/.vinxi',
            '!**/.turbo',
            '!**/routeTree.gen.ts',
            '!**/next-env.d.ts',
            '!**/convex/_generated',
          ],
        },
        linter: { enabled: true },
        formatter: { enabled: false },
        javascript: {
          parser: nestDecorators
            ? { unsafeParameterDecoratorsEnabled: true }
            : {},
        },
        css: { parser: { tailwindDirectives: true } },
        // The shared UI components are vendored from shadcn unchanged.
        overrides: [
          {
            includes: ['packages/ui/src/**'],
            linter: {
              rules: {
                a11y: {
                  noLabelWithoutControl: 'off',
                  useSemanticElements: 'off',
                },
                style: { useImportType: 'off' },
                suspicious: { noArrayIndexKey: 'off', noDoubleEquals: 'off' },
              },
            },
          },
        ],
      },
      null,
      2
    )
  );
}
