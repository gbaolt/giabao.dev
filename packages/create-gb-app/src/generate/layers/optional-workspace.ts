import type { EmitCtx, FileMap, GenerateContext } from '../../types/generate';
import type { Stack } from '../../types/stack';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { addReadmeSection, type Manifest } from '../project-model';
import { workspaceProtocol } from '../workspace-protocol';

export function emitOptionalWorkspace(
  ctx: EmitCtx,
  generateSingle: (
    stack: Stack,
    context: GenerateContext
  ) => { files: FileMap; manifest: Manifest }
): void {
  if (ctx.stack.backend !== 'self' && ctx.stack.backend !== 'convex') {
    throw new Error(
      'Optional workspaces require a fullstack or Convex backend'
    );
  }
  const singleStack = { ...ctx.stack, structure: 'single' as const };
  const { files: single, manifest: web } = generateSingle(singleStack, ctx);
  web.name = 'web';
  web.version = '0.0.0';
  const protocol = workspaceProtocol(ctx.packageManager);
  Object.assign((web.dependencies ??= {}), {
    '@repo/ui': protocol,
    '@repo/validation': protocol,
  });
  (web.devDependencies ??= {})['@repo/typescript-config'] = protocol;

  for (const [path, contents] of Object.entries(single))
    setFile(
      ctx.files,
      `${ctx.layout.frontendRoot}/${path}`,
      toWorkspaceSource(path, contents)
    );
  ctx.project.manifests[ctx.layout.frontendManifest] = web;

  ctx.pkg.workspaces = ['apps/*', 'packages/*'];
  ctx.project.manifests['packages/typescript-config/package.json'] = {
    name: '@repo/typescript-config',
    version: '0.0.0',
    private: true,
    files: ['base.json'],
  };
  setFile(
    ctx.files,
    'packages/typescript-config/base.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
        },
      },
      null,
      2
    )
  );
  ctx.project.manifests['packages/ui/package.json'] = {
    name: '@repo/ui',
    version: '0.0.0',
    private: true,
    type: 'module',
    exports: {},
    dependencies: { react: DEPENDENCY_VERSIONS.react },
    devDependencies: {
      '@types/react': DEPENDENCY_VERSIONS['@types/react'],
      '@repo/typescript-config': protocol,
    },
  };
  setFile(
    ctx.files,
    `${ctx.layout.libDir}/note-validation.ts`,
    'export { noteInputSchema, type NoteInput } from "@repo/validation";\n'
  );
  const convexSetup =
    ctx.stack.backend === 'convex'
      ? '\n\nRun the root convex:dev task first to configure a deployment, generate apps/web/convex/_generated, and write apps/web/.env.local. Set NEXT_PUBLIC_CONVEX_URL for Next.js or VITE_CONVEX_URL for Start to the deployment URL. Keep convex:dev running alongside the root dev task. Run convex:codegen after function changes when needed. The app cannot typecheck before codegen. If Clerk is selected, configure its convex JWT template and set CLERK_JWT_ISSUER_DOMAIN in the Convex deployment environment. Live deployment setup requires your own Convex account.'
      : '';
  addReadmeSection(
    ctx.project,
    'configuration-notes',
    `The fullstack web application lives in apps/web. Shared UI, domain validation, and TypeScript configuration live in packages. Run the root dev task to start the app; shared validation builds first. Database tasks delegate to the web application and use its local environment and schema.${convexSetup}`
  );
}

/** Rewrites one file of the inner single app for its place in apps/web. */
function toWorkspaceSource(path: string, contents: string): string {
  if (path === 'tsconfig.json')
    return JSON.stringify(
      { ...JSON.parse(contents), extends: '@repo/typescript-config/base.json' },
      null,
      2
    );
  const source = contents.replace(
    /(["'])(?:@\/|(?:\.\.\/)+)components\/ui\/([^"']+)\1/g,
    '"@repo/ui/$2"'
  );
  return path === 'convex/notes.ts'
    ? source.replace(
        /from "\.\.\/(?:src\/)?lib\/note-validation"/,
        'from "@repo/validation"'
      )
    : source;
}
