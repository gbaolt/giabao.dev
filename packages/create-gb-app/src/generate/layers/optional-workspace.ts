import type { EmitCtx, FileMap, GenerateContext } from '../../types/generate';
import type { Stack } from '../../types/stack';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { workspaceProtocol } from '../workspace-protocol';

export function emitOptionalWorkspace(
  ctx: EmitCtx,
  generateSingle: (stack: Stack, context: GenerateContext) => FileMap
): void {
  if (ctx.stack.backend !== 'self' && ctx.stack.backend !== 'convex') {
    throw new Error(
      'Optional workspaces require a fullstack or Convex backend'
    );
  }
  const singleStack = { ...ctx.stack, structure: 'single' as const };
  const single = generateSingle(singleStack, ctx);
  const web = JSON.parse(single['package.json']);
  web.name = 'web';
  web.version = '0.0.0';
  const protocol = workspaceProtocol(ctx.packageManager);
  web.dependencies['@repo/ui'] = protocol;
  web.dependencies['@repo/validation'] = protocol;
  web.devDependencies['@repo/typescript-config'] = protocol;

  for (const [path, contents] of Object.entries(single)) {
    if (path === 'package.json' || path === 'README.md') continue;
    const source = contents.replace(
      /(["'])(?:@\/|(?:\.\.\/)+)components\/ui\/([^"']+)\1/g,
      '"@repo/ui/$2"'
    );
    setFile(ctx.files, `${ctx.layout.frontendRoot}/${path}`, source);
  }
  setFile(ctx.files, ctx.layout.frontendManifest, JSON.stringify(web, null, 2));
  const tsconfigPath = `${ctx.layout.frontendRoot}/tsconfig.json`;
  const tsconfig = JSON.parse(ctx.files[tsconfigPath]);
  tsconfig.extends = '@repo/typescript-config/base.json';
  setFile(ctx.files, tsconfigPath, JSON.stringify(tsconfig, null, 2));

  ctx.pkg.workspaces = ['apps/*', 'packages/*'];
  setFile(
    ctx.files,
    'packages/typescript-config/package.json',
    JSON.stringify(
      {
        name: '@repo/typescript-config',
        version: '0.0.0',
        private: true,
        files: ['base.json'],
      },
      null,
      2
    )
  );
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
  setFile(
    ctx.files,
    'packages/ui/package.json',
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
  setFile(
    ctx.files,
    `${ctx.layout.libDir}/note-validation.ts`,
    'export { noteInputSchema, type NoteInput } from "@repo/validation";\n'
  );
  if (ctx.stack.backend === 'convex') {
    const convexNotes = `${ctx.layout.backendRoot}/notes.ts`;
    const notes = ctx.files[convexNotes];
    setFile(
      ctx.files,
      convexNotes,
      notes.replace(
        /from "\.\.\/(?:src\/)?lib\/note-validation"/,
        'from "@repo/validation"'
      )
    );
  }
  const convexSetup =
    ctx.stack.backend === 'convex'
      ? '\nRun the root convex:dev task first to configure a deployment, generate apps/web/convex/_generated, and write apps/web/.env.local. Set NEXT_PUBLIC_CONVEX_URL for Next.js or VITE_CONVEX_URL for Start to the deployment URL. Keep convex:dev running alongside the root dev task. Run convex:codegen after function changes when needed. The app cannot typecheck before codegen. If Clerk is selected, configure its convex JWT template and set CLERK_JWT_ISSUER_DOMAIN in the Convex deployment environment. Live deployment setup requires your own Convex account.\n'
      : '';
  setFile(
    ctx.files,
    'README.md',
    `# ${ctx.projectName}\n\nThe fullstack web application lives in apps/web. Shared UI, domain validation, and TypeScript configuration live in packages. Run the root dev task to start the app; shared validation builds first. Database tasks delegate to the web application and use its local environment and schema.\n${convexSetup}`
  );
}
