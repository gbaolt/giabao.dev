import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { workspaceProtocol } from '../workspace-protocol';
import { emitBiome } from './biome';
import { emitDatabase } from './database';
import { emitEslint } from './eslint';
import { emitOxlint } from './oxlint';

export const SERVER_PORT = 3333;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const WEB_ORIGIN = 'http://localhost:3000';
export const SERVER_LISTEN_PORT = `Number(process.env.SERVER_PORT ?? process.env.PORT ?? ${SERVER_PORT})`;

/** The framework-specific half of a server workspace. */
export type ServerAdapter = {
  /** NodeNext servers run compiled output, so the contract ships a build. */
  nodeNext: boolean;
  tsconfig: { compilerOptions: Record<string, unknown>; include: string[] };
  /** Writes the entry, modules and routes. */
  emit: (ctx: EmitCtx, dep: string) => void;
};

export type ServerManifest = {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

export function emitServerWorkspace(
  ctx: EmitCtx,
  adapter: ServerAdapter
): void {
  const dep = workspaceProtocol(ctx.packageManager);
  ctx.pkg.private = true;
  ctx.pkg.devDependencies.typescript = DEPENDENCY_VERSIONS['typescript'];
  ctx.pkg.workspaces = ['apps/*', 'packages/*'];

  if (ctx.stack.backend === 'hono' || ctx.stack.frontend === 'tanstack-start')
    setFile(
      ctx.files,
      '.gitignore',
      `node_modules
.next
.output
.vinxi
dist
.env
*.log
`
    );
  emitTypescriptConfig(ctx);
  emitDatabase(ctx);
  setFile(
    ctx.files,
    'apps/server/tsconfig.json',
    JSON.stringify(
      { extends: '@repo/typescript-config/base.json', ...adapter.tsconfig },
      null,
      2
    )
  );
  if (ctx.stack.backend !== 'convex') {
    if (ctx.stack.api === 'orpc') emitOrpcContract(ctx, dep, adapter.nodeNext);
    else if (ctx.stack.api === 'trpc')
      emitTrpcContract(ctx, dep, adapter.nodeNext);
  }
  emitUiPackage(ctx, dep);
  adapter.emit(ctx, dep);
  emitLinter(ctx);
}

export function writeServerManifest(
  ctx: EmitCtx,
  manifest: ServerManifest
): void {
  setFile(
    ctx.files,
    'apps/server/package.json',
    JSON.stringify(
      {
        name: 'server',
        version: '0.0.0',
        private: true,
        type: 'module',
        ...manifest,
      },
      null,
      2
    )
  );
}

function emitLinter(ctx: EmitCtx): void {
  switch (ctx.stack.addons.linting) {
    case 'biome':
      emitBiome(ctx);
      break;
    case 'eslint':
      emitEslint(ctx);
      break;
    case 'oxlint':
      emitOxlint(ctx);
      break;
    default: {
      const _exhaustive: never = ctx.stack.addons.linting;
      throw new Error(`unhandled linter: ${_exhaustive}`);
    }
  }
}

function emitTypescriptConfig(ctx: EmitCtx): void {
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
          strict: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          skipLibCheck: true,
        },
      },
      null,
      2
    )
  );
}

function emitContractPackage(
  ctx: EmitCtx,
  dep: string,
  compiled: boolean,
  dependencies: Record<string, string>
): void {
  setFile(
    ctx.files,
    'packages/contract/package.json',
    JSON.stringify(
      {
        name: '@repo/contract',
        version: '0.0.0',
        private: true,
        type: 'module',
        ...(compiled
          ? {
              exports: {
                '.': { types: './dist/index.d.ts', default: './dist/index.js' },
              },
              scripts: { build: 'tsc -p tsconfig.json' },
            }
          : { exports: { '.': './src/index.ts' } }),
        dependencies,
        devDependencies: {
          '@repo/typescript-config': dep,
          ...(compiled
            ? { typescript: DEPENDENCY_VERSIONS['typescript'] }
            : {}),
        },
      },
      null,
      2
    )
  );
  if (!compiled) return;
  setFile(
    ctx.files,
    'packages/contract/tsconfig.json',
    JSON.stringify(
      {
        extends: '@repo/typescript-config/base.json',
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
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
}

function emitOrpcContract(ctx: EmitCtx, dep: string, compiled: boolean): void {
  emitContractPackage(ctx, dep, compiled, {
    '@orpc/contract': DEPENDENCY_VERSIONS['@orpc/contract'],
    '@orpc/openapi': DEPENDENCY_VERSIONS['@orpc/openapi'],
    zod: DEPENDENCY_VERSIONS['zod'],
  });
  setFile(
    ctx.files,
    'packages/contract/src/index.ts',
    `export { contract } from "./contract${compiled ? '.js' : ''}";
`
  );
  setFile(
    ctx.files,
    'packages/contract/src/contract.ts',
    `import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { noteInputSchema } from "@repo/validation";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const contract = {
  me: oc
    .meta(openapi({ method: "GET", path: "/me" }))
    .output(UserSchema),
  notes: {
    list: oc
      .meta(openapi({ method: "GET", path: "/notes" }))
      .output(z.array(NoteSchema)),
    create: oc
      .meta(openapi({ method: "POST", path: "/notes" }))
      .input(noteInputSchema)
      .output(NoteSchema),
    update: oc
      .meta(openapi({ method: "PATCH", path: "/notes/{id}" }))
      .input(
        z.object({
          id: z.string(),
          ...noteInputSchema.shape,
        }),
      )
      .output(NoteSchema),
    delete: oc
      .meta(openapi({ method: "DELETE", path: "/notes/{id}" }))
      .input(z.object({ id: z.string() }))
      .output(z.object({ ok: z.literal(true) })),
  },
};
`
  );
}

function emitTrpcContract(ctx: EmitCtx, dep: string, compiled: boolean): void {
  emitContractPackage(ctx, dep, compiled, {
    '@trpc/server': DEPENDENCY_VERSIONS['@trpc/server'],
    zod: DEPENDENCY_VERSIONS['zod'],
  });
  setFile(
    ctx.files,
    'packages/contract/src/index.ts',
    `import { initTRPC } from "@trpc/server";
import { noteInputSchema } from "@repo/validation";
import { z } from "zod";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteInput = { title: string; body: string };

export type NoteStore = {
  list: (userId: string | null) => Promise<Note[]>;
  create: (userId: string | null, input: NoteInput) => Promise<Note>;
  update: (
    userId: string | null,
    input: NoteInput & { id: string },
  ) => Promise<Note>;
  remove: (userId: string | null, id: string) => Promise<{ ok: true }>;
};

export type TrpcContext = {
  userId: string | null;
  notes: NoteStore;
};

const t = initTRPC.context<TrpcContext>().create();

export const appRouter = t.router({
  notes: t.router({
    list: t.procedure.query(({ ctx }) => ctx.notes.list(ctx.userId)),
    create: t.procedure
      .input(noteInputSchema)
      .mutation(({ ctx, input }) => ctx.notes.create(ctx.userId, input)),
    update: t.procedure
      .input(z.object({ id: z.string(), ...noteInputSchema.shape }))
      .mutation(({ ctx, input }) => ctx.notes.update(ctx.userId, input)),
    remove: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(({ ctx, input }) => ctx.notes.remove(ctx.userId, input.id)),
  }),
});

export type AppRouter = typeof appRouter;
`
  );
}

function emitUiPackage(ctx: EmitCtx, dep: string): void {
  setFile(
    ctx.files,
    'packages/ui/package.json',
    JSON.stringify(
      {
        name: '@repo/ui',
        version: '0.0.0',
        private: true,
        type: 'module',
        exports: {
          './button': './src/button.tsx',
          './input': './src/input.tsx',
          './card': './src/card.tsx',
          './utils': './src/utils.ts',
        },
        dependencies: {
          react: DEPENDENCY_VERSIONS['react'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          '@types/react': DEPENDENCY_VERSIONS['@types/react'],
        },
      },
      null,
      2
    )
  );
}
