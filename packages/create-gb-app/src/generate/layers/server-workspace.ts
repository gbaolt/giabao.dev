import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { joinPath } from '../layout';
import { setProviders } from '../project-model';
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

  ctx.project.ignoreLines.push(
    'node_modules',
    '.next',
    '.output',
    '.vinxi',
    'dist',
    '.env',
    '*.log'
  );
  emitTypescriptConfig(ctx);
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
  // The database adds its packages to the manifest the adapter registers.
  emitDatabase(ctx);
  emitLinter(ctx);
}

/**
 * Renders the web app beside the server: the frontend emit module writes it
 * into apps/web with its own manifest, then the API client is wired to the
 * server.
 */
export function emitServerWebApp(
  ctx: EmitCtx,
  emitFrontend: (webCtx: EmitCtx) => void
): void {
  const dep = workspaceProtocol(ctx.packageManager);
  const pkg = {
    name: 'web',
    version: '0.0.0',
    private: true as const,
    type: 'module' as const,
    scripts: {},
    dependencies: { '@repo/ui': dep },
    devDependencies: { '@repo/typescript-config': dep },
  };
  const webCtx = { ...ctx, pkg };
  emitFrontend(webCtx);
  emitServerClient(webCtx, dep);
  ctx.project.manifests[ctx.layout.frontendManifest] = pkg;
}

function emitServerClient(ctx: EmitCtx, dep: string): void {
  const { stack, layout } = ctx;
  if (stack.backend === 'convex') return;
  const next = stack.frontend === 'next';
  const env = next
    ? 'process.env.NEXT_PUBLIC_SERVER_URL'
    : 'import.meta.env.VITE_SERVER_URL';
  const deps = ctx.pkg.dependencies;
  const lib = (name: string) => joinPath(layout.libDir, name);
  const orpc = stack.api === 'orpc' && stack.database !== 'none';

  if (orpc) {
    deps['@orpc/client'] = DEPENDENCY_VERSIONS['@orpc/client'];
    deps['@orpc/contract'] = DEPENDENCY_VERSIONS['@orpc/contract'];
    deps['@orpc/openapi'] = DEPENDENCY_VERSIONS['@orpc/openapi'];
    deps['@orpc/tanstack-query'] = DEPENDENCY_VERSIONS['@orpc/tanstack-query'];
    deps['@repo/contract'] = dep;
    deps['@tanstack/react-query'] =
      DEPENDENCY_VERSIONS['@tanstack/react-query'];
    if (next) {
      deps['@tanstack/react-query-next-experimental'] =
        DEPENDENCY_VERSIONS['@tanstack/react-query-next-experimental'];
      deps['server-only'] = DEPENDENCY_VERSIONS['server-only'];
    }
    // Hono mounts the oRPC handler under /api; Nest serves it at the root.
    const url =
      stack.backend === 'hono'
        ? `(${env} ?? "${SERVER_URL}") + "/api"`
        : `${env} ?? "${SERVER_URL}"`;
    setFile(
      ctx.files,
      lib('orpc-link.ts'),
      `import { OpenAPILink } from "@orpc/openapi/fetch";
import { contract } from "@repo/contract";

export function createOrpcLink(getHeaders?: () => Promise<Record<string, string>>) {
  return new OpenAPILink(contract, {
    url: ${url},
    fetch: (url, init) =>
      globalThis.fetch(url, {
        ...init,
        credentials: "include",
      }),
    ...(getHeaders ? { headers: getHeaders } : {}),
  });
}
`
    );
    setFile(
      ctx.files,
      lib('orpc.ts'),
      `${next ? '"use client";\n\n' : ''}import { createORPCClient } from "@orpc/client";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { contract } from "@repo/contract";
import { createOrpcLink } from "./orpc-link";

export const client: RouterContractClient<typeof contract> = createORPCClient(
  createOrpcLink(),
);

export const orpc = createTanstackQueryUtils(client);
`
    );
    if (next)
      setFile(
        ctx.files,
        lib('orpc.server.ts'),
        `import "server-only";

import { createORPCClient } from "@orpc/client";
import type { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { contract } from "@repo/contract";
import { headers } from "next/headers";
import { createOrpcLink } from "./orpc-link";

export const client: RouterContractClient<typeof contract> = createORPCClient(
  createOrpcLink(async () => {
    const incoming = await headers();
    const cookie = incoming.get("cookie");
    return cookie ? { cookie } : {};
  }),
);

export const orpc = createTanstackQueryUtils(client);
`
      );
    setFile(
      ctx.files,
      lib('query-client.ts'),
      `import { QueryClient } from "@tanstack/react-query";

export function getQueryClient() {
  return new QueryClient();
}
`
    );
  }

  if (stack.api === 'trpc' && stack.database !== 'none') {
    deps['@repo/contract'] = dep;
    deps['@tanstack/react-query'] =
      DEPENDENCY_VERSIONS['@tanstack/react-query'];
    deps['@trpc/client'] = DEPENDENCY_VERSIONS['@trpc/client'];
    deps['@trpc/react-query'] = DEPENDENCY_VERSIONS['@trpc/react-query'];
    if (next)
      setFile(
        ctx.files,
        lib('trpc.ts'),
        `import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@repo/contract";

export const trpc = createTRPCReact<AppRouter>();
`
      );
  }

  // Clerk's Next components need its provider; Start reads the session server-side.
  const clerk = stack.auth === 'clerk' && next;
  if (orpc || clerk)
    setProviders(
      ctx.project,
      serverProviders(next, orpc, clerk)
    );
}

function serverProviders(next: boolean, query: boolean, clerk: boolean) {
  const wrappers = [
    ...(clerk ? [['<ClerkProvider>', '</ClerkProvider>']] : []),
    ...(query
      ? [
          [
            '<QueryClientProvider client={queryClient}>',
            '</QueryClientProvider>',
          ],
        ]
      : []),
  ];
  const indent = (depth: number) => '  '.repeat(depth + 2);
  const tree = [
    ...wrappers.map(([open], depth) => indent(depth) + open),
    indent(wrappers.length) + '{props.children}',
    ...wrappers.map(([, close], depth) => indent(depth) + close).reverse(),
  ]
    .join('\n')
    .trimStart();
  return `${next ? '"use client";\n\n' : ''}${clerk ? 'import { ClerkProvider } from "@clerk/nextjs";\n' : ''}${query ? 'import { QueryClientProvider } from "@tanstack/react-query";\n' : ''}import type { ReactNode } from "react";
${query ? 'import { getQueryClient } from "@/lib/query-client";\n' : ''}
export function Providers(props: { children: ReactNode }) {
${query ? '  const queryClient = getQueryClient();\n' : ''}  return (
    ${tree}
  );
}
`;
}

export function writeServerManifest(
  ctx: EmitCtx,
  manifest: ServerManifest
): void {
  ctx.project.manifests['apps/server/package.json'] = {
    name: 'server',
    version: '0.0.0',
    private: true,
    type: 'module',
    ...manifest,
  };
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
  ctx.project.manifests['packages/contract/package.json'] = {
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
      ...(compiled ? { typescript: DEPENDENCY_VERSIONS['typescript'] } : {}),
    },
  };
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
  ctx.project.manifests['packages/ui/package.json'] = {
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
  };
}
