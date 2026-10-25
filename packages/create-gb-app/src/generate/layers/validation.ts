import type { EmitCtx, PackageJsonShape } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { workspaceProtocol } from '../workspace-protocol';

const noteValidationSource = `import { z } from 'zod';

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  body: z.string(),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
`;

function addWorkspaceDependency(ctx: EmitCtx, path: string): void {
  const source = ctx.files[path];
  if (!source) {
    return;
  }
  const pkg = JSON.parse(source) as PackageJsonShape;
  pkg.dependencies['@repo/validation'] = workspaceProtocol(ctx.packageManager);
  setFile(ctx.files, path, JSON.stringify(pkg, null, 2));
}

export function emitValidation(ctx: EmitCtx): void {
  if (ctx.stack.structure === 'single') {
    ctx.pkg.dependencies.zod = DEPENDENCY_VERSIONS['zod'];
    setFile(
      ctx.files,
      `${ctx.layout.libDir}/note-validation.ts`,
      noteValidationSource
    );
    return;
  }

  setFile(ctx.files, 'packages/validation/src/index.ts', noteValidationSource);
  setFile(
    ctx.files,
    'packages/validation/package.json',
    JSON.stringify(
      {
        name: '@repo/validation',
        version: '0.0.0',
        private: true,
        type: 'module',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            default: './dist/index.js',
          },
        },
        scripts: { build: 'tsc -p tsconfig.json' },
        dependencies: { zod: DEPENDENCY_VERSIONS['zod'] },
        devDependencies: { typescript: DEPENDENCY_VERSIONS['typescript'] },
      },
      null,
      2
    )
  );
  setFile(
    ctx.files,
    'packages/validation/tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          declaration: true,
          outDir: 'dist',
          rootDir: 'src',
        },
        include: ['src/**/*.ts'],
      },
      null,
      2
    )
  );
  addWorkspaceDependency(ctx, 'apps/web/package.json');
  addWorkspaceDependency(ctx, 'apps/server/package.json');
  addWorkspaceDependency(ctx, 'packages/contract/package.json');
}
