import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { GenerateError } from '../errors';
import { setFile } from '../files';
import { workspaceProtocol } from '../workspace-protocol';
import { emitBiome } from './biome';
import { emitDbSetup } from './db-setup';
import { emitDrizzle } from './drizzle';
import { emitEslint } from './eslint';
import { emitOxlint } from './oxlint';
import { emitPostgres } from './postgres';
import { emitPrisma } from './prisma';
import { emitStartWebApp, startPassthroughProviders } from './start';

function proto(ctx: EmitCtx): string {
  return workspaceProtocol(ctx.packageManager);
}

export function emitNest(ctx: EmitCtx): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitNest requires nest');
  }
  if (ctx.stack.api === 'trpc') {
    throw new GenerateError(
      'nest-trpc',
      'nest trpc generate is not implemented yet'
    );
  }

  const dep = proto(ctx);
  ctx.pkg.private = true;
  ctx.pkg.devDependencies.typescript = DEPENDENCY_VERSIONS['typescript'];
  ctx.pkg.workspaces = ['apps/*', 'packages/*'];

  if (ctx.stack.database !== 'none') {
    emitPostgres(ctx);
    switch (ctx.stack.orm) {
      case 'prisma':
        emitPrisma(ctx);
        break;
      case 'drizzle':
        emitDrizzle(ctx);
        break;
      case 'none':
        throw new Error('orm none requires database none');
      default: {
        const _exhaustive: never = ctx.stack.orm;
        throw new Error(`unhandled orm: ${_exhaustive}`);
      }
    }
    emitDbSetup(ctx);
  }

  if (ctx.stack.frontend === 'tanstack-start') {
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
  }

  emitTypescriptConfig(ctx, dep);
  setFile(
    ctx.files,
    'apps/server/tsconfig.json',
    JSON.stringify(
      {
        extends: '@repo/typescript-config/base.json',
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          outDir: 'dist',
          rootDir: 'src',
        },
        include: ['src/**/*.ts'],
      },
      null,
      2
    )
  );
  if (ctx.stack.api === 'orpc') {
    emitContract(ctx, dep);
  }
  emitUiPackage(ctx, dep);
  if (ctx.stack.database === 'none') {
    emitShellServer(ctx, dep);
  } else if (ctx.stack.api === 'none') {
    emitRestServer(ctx, dep);
  } else {
    emitServer(ctx, dep);
  }
  emitWeb(ctx, dep);

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

function emitTypescriptConfig(ctx: EmitCtx, _dep: string): void {
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

function emitContract(ctx: EmitCtx, dep: string): void {
  setFile(
    ctx.files,
    'packages/contract/package.json',
    JSON.stringify(
      {
        name: '@repo/contract',
        version: '0.0.0',
        private: true,
        type: 'module',
        exports: {
          '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        },
        scripts: { build: 'tsc -p tsconfig.json' },
        dependencies: {
          '@orpc/contract': DEPENDENCY_VERSIONS['@orpc/contract'],
          '@orpc/openapi': DEPENDENCY_VERSIONS['@orpc/openapi'],
          zod: DEPENDENCY_VERSIONS['zod'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'packages/contract/src/index.ts',
    `export { contract } from "./contract.js";
`
  );

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

function emitShellServer(ctx: EmitCtx, dep: string): void {
  setFile(
    ctx.files,
    'apps/server/package.json',
    JSON.stringify(
      {
        name: 'server',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx watch src/main.ts',
          start: 'node dist/main.js',
          build: 'tsc',
        },
        dependencies: {
          '@nestjs/common': DEPENDENCY_VERSIONS['@nestjs/common'],
          '@nestjs/core': DEPENDENCY_VERSIONS['@nestjs/core'],
          '@nestjs/platform-express':
            DEPENDENCY_VERSIONS['@nestjs/platform-express'],
          'reflect-metadata': DEPENDENCY_VERSIONS['reflect-metadata'],
          rxjs: DEPENDENCY_VERSIONS['rxjs'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          '@types/express': DEPENDENCY_VERSIONS['@types/express'],
          '@types/node': DEPENDENCY_VERSIONS['@types/node'],
          tsx: DEPENDENCY_VERSIONS['tsx'],
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3333));
}

void bootstrap();
`
  );

  setFile(
    ctx.files,
    'apps/server/src/app.module.ts',
    `import { Module } from "@nestjs/common";

@Module({})
export class AppModule {}
`
  );
}

function emitRestServer(ctx: EmitCtx, dep: string): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitRestServer requires nest');
  }
  const authed = ctx.stack.auth === 'better-auth';
  const dependencies: Record<string, string> = {
    '@nestjs/common': DEPENDENCY_VERSIONS['@nestjs/common'],
    '@nestjs/core': DEPENDENCY_VERSIONS['@nestjs/core'],
    '@nestjs/platform-express': DEPENDENCY_VERSIONS['@nestjs/platform-express'],
    '@prisma/client': DEPENDENCY_VERSIONS['@prisma/client'],
    'reflect-metadata': DEPENDENCY_VERSIONS['reflect-metadata'],
    rxjs: DEPENDENCY_VERSIONS['rxjs'],
  };
  if (authed) {
    dependencies['@thallesp/nestjs-better-auth'] =
      DEPENDENCY_VERSIONS['@thallesp/nestjs-better-auth'];
    dependencies['better-auth'] = DEPENDENCY_VERSIONS['better-auth'];
  }

  setFile(
    ctx.files,
    'apps/server/package.json',
    JSON.stringify(
      {
        name: 'server',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx watch src/main.ts',
          start: 'node dist/main.js',
          build: 'tsc',
        },
        dependencies,
        devDependencies: {
          '@repo/typescript-config': dep,
          '@types/express': DEPENDENCY_VERSIONS['@types/express'],
          '@types/node': DEPENDENCY_VERSIONS['@types/node'],
          prisma: DEPENDENCY_VERSIONS['prisma'],
          tsx: DEPENDENCY_VERSIONS['tsx'],
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule${authed ? ', { bodyParser: false }' : ''});

  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  await app.listen(Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3333));
}

void bootstrap();
`
  );

  setFile(
    ctx.files,
    'apps/server/src/app.module.ts',
    authed
      ? `import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth.js";
import { NotesController } from "./notes.controller.js";

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
      },
    }),
  ],
  controllers: [NotesController],
})
export class AppModule {}
`
      : `import { Module } from "@nestjs/common";
import { NotesController } from "./notes.controller.js";

@Module({
  controllers: [NotesController],
})
export class AppModule {}
`
  );

  if (authed) {
    setFile(
      ctx.files,
      'apps/server/src/auth.ts',
      `import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:3000"],
});
`
    );
  }

}

function emitServer(ctx: EmitCtx, dep: string): void {
  setFile(
    ctx.files,
    'apps/server/package.json',
    JSON.stringify(
      {
        name: 'server',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx watch src/main.ts',
          start: 'node dist/main.js',
          build: 'tsc',
        },
        dependencies: {
          '@nestjs/common': DEPENDENCY_VERSIONS['@nestjs/common'],
          '@nestjs/core': DEPENDENCY_VERSIONS['@nestjs/core'],
          '@nestjs/platform-express':
            DEPENDENCY_VERSIONS['@nestjs/platform-express'],
          '@orpc/nest': DEPENDENCY_VERSIONS['@orpc/nest'],
          '@orpc/openapi': DEPENDENCY_VERSIONS['@orpc/openapi'],
          '@orpc/server': DEPENDENCY_VERSIONS['@orpc/server'],
          '@prisma/client': DEPENDENCY_VERSIONS['@prisma/client'],
          '@repo/contract': dep,
          '@thallesp/nestjs-better-auth':
            DEPENDENCY_VERSIONS['@thallesp/nestjs-better-auth'],
          'better-auth': DEPENDENCY_VERSIONS['better-auth'],
          'reflect-metadata': DEPENDENCY_VERSIONS['reflect-metadata'],
          rxjs: DEPENDENCY_VERSIONS['rxjs'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          '@types/express': DEPENDENCY_VERSIONS['@types/express'],
          '@types/node': DEPENDENCY_VERSIONS['@types/node'],
          prisma: DEPENDENCY_VERSIONS['prisma'],
          tsx: DEPENDENCY_VERSIONS['tsx'],
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  await app.listen(Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3333));
}

void bootstrap();
`
  );

  setFile(
    ctx.files,
    'apps/server/src/app.module.ts',
    `import { type ExecutionContext, Module } from "@nestjs/common";
import { ORPCModule } from "@orpc/nest";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { auth } from "./auth.js";
import { NotesController } from "./notes.controller.js";

declare module "@orpc/server" {
  interface DefaultInitialContext {
    request: Request;
  }
}

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
      },
    }),
    ORPCModule.forRoot({
      context: (ctx: ExecutionContext) => ({
        request: ctx.switchToHttp().getRequest<Request>(),
      }),
    }),
  ],
  controllers: [NotesController],
})
export class AppModule {}
`
  );

  setFile(
    ctx.files,
    'apps/server/src/auth.ts',
    `import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:3000"],
});
`
  );
}

const SERVER_URL = 'http://localhost:3333';

function emitNestStartWeb(ctx: EmitCtx, dep: string): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitNestStartWeb requires nest');
  }

  const orpcWeb = ctx.stack.api === 'orpc' && ctx.stack.database !== 'none';
  const dependencies: Record<string, string> = {
    '@repo/ui': dep,
    '@tanstack/react-router': DEPENDENCY_VERSIONS['@tanstack/react-router'],
    '@tanstack/router-core': DEPENDENCY_VERSIONS['@tanstack/router-core'],
    '@tanstack/react-router-devtools':
      DEPENDENCY_VERSIONS['@tanstack/react-router-devtools'],
    '@tanstack/react-start': DEPENDENCY_VERSIONS['@tanstack/react-start'],
    react: DEPENDENCY_VERSIONS['react'],
    'react-dom': DEPENDENCY_VERSIONS['react-dom'],
  };
  if (orpcWeb || ctx.stack.auth === 'better-auth') {
    dependencies['better-auth'] = DEPENDENCY_VERSIONS['better-auth'];
  }
  if (orpcWeb) {
    dependencies['@orpc/client'] = DEPENDENCY_VERSIONS['@orpc/client'];
    dependencies['@orpc/contract'] = DEPENDENCY_VERSIONS['@orpc/contract'];
    dependencies['@orpc/openapi'] = DEPENDENCY_VERSIONS['@orpc/openapi'];
    dependencies['@orpc/tanstack-query'] =
      DEPENDENCY_VERSIONS['@orpc/tanstack-query'];
    dependencies['@repo/contract'] = dep;
    dependencies['@tanstack/react-query'] =
      DEPENDENCY_VERSIONS['@tanstack/react-query'];
  }

  emitStartWebApp(ctx, {
    dependencies,
    devDependencies: {
      '@repo/typescript-config': dep,
      '@tailwindcss/vite': DEPENDENCY_VERSIONS['@tailwindcss/vite'],
      '@types/node': DEPENDENCY_VERSIONS['@types/node'],
      '@types/react': DEPENDENCY_VERSIONS['@types/react'],
      '@types/react-dom': DEPENDENCY_VERSIONS['@types/react-dom'],
      '@vitejs/plugin-react': DEPENDENCY_VERSIONS['@vitejs/plugin-react'],
      tailwindcss: DEPENDENCY_VERSIONS['tailwindcss'],
      typescript: DEPENDENCY_VERSIONS['typescript'],
      vite: DEPENDENCY_VERSIONS['vite'],
      'vite-tsconfig-paths': DEPENDENCY_VERSIONS['vite-tsconfig-paths'],
    },
    providers: orpcWeb ? nestStartOrpcProviders() : startPassthroughProviders(),
    notesLink: ctx.stack.database !== 'none',
  });

  if (orpcWeb || ctx.stack.auth === 'better-auth') {
    setFile(
      ctx.files,
      'apps/web/src/lib/auth-client.ts',
      `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL ?? "${SERVER_URL}",
});
`
    );
  }

  if (orpcWeb) {
    setFile(
      ctx.files,
      'apps/web/src/lib/orpc-link.ts',
      `import { OpenAPILink } from "@orpc/openapi/fetch";
import { contract } from "@repo/contract";

export function createOrpcLink(getHeaders?: () => Promise<Record<string, string>>) {
  return new OpenAPILink(contract, {
    url: import.meta.env.VITE_SERVER_URL ?? "${SERVER_URL}",
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
      'apps/web/src/lib/orpc.ts',
      `import { createORPCClient } from "@orpc/client";
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
    setFile(
      ctx.files,
      'apps/web/src/lib/query-client.ts',
      `import { QueryClient } from "@tanstack/react-query";

export function getQueryClient() {
  return new QueryClient();
}
`
    );
    setFile(ctx.files, 'apps/web/src/routes/login.tsx', nestStartLoginRoute());
  }
}

function nestStartOrpcProviders(): string {
  return `import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "../lib/query-client";

export function Providers(props: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
`;
}

function nestStartLoginRoute(): string {
  return `import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      return;
    }
    void navigate({ to: "/notes" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        ) : null}
        <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit">{mode === "signin" ? "Sign in" : "Sign up"}</button>
      </form>
    </main>
  );
}
`;
}

function emitWebShell(ctx: EmitCtx, dep: string): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitWebShell requires nest');
  }
  const notes = ctx.stack.database !== 'none' && ctx.stack.api === 'none';
  const authClient = ctx.stack.auth === 'better-auth';

  setFile(
    ctx.files,
    'apps/web/package.json',
    JSON.stringify(
      {
        name: 'web',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          '@repo/ui': dep,
          ...(authClient
            ? { 'better-auth': DEPENDENCY_VERSIONS['better-auth'] }
            : {}),
          next: DEPENDENCY_VERSIONS['next'],
          react: DEPENDENCY_VERSIONS['react'],
          'react-dom': DEPENDENCY_VERSIONS['react-dom'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          '@tailwindcss/postcss': DEPENDENCY_VERSIONS['@tailwindcss/postcss'],
          '@types/node': DEPENDENCY_VERSIONS['@types/node'],
          '@types/react': DEPENDENCY_VERSIONS['@types/react'],
          '@types/react-dom': DEPENDENCY_VERSIONS['@types/react-dom'],
          tailwindcss: DEPENDENCY_VERSIONS['tailwindcss'],
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'apps/web/next.config.ts',
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`
  );

  setFile(
    ctx.files,
    'apps/web/app/globals.css',
    `@import "tailwindcss";
`
  );

  setFile(
    ctx.files,
    'apps/web/app/layout.tsx',
    `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "${ctx.projectName}" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  );

  setFile(
    ctx.files,
    'apps/web/app/page.tsx',
    `${notes ? `import Link from "next/link";\n\n` : ''}export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">${ctx.projectName}</h1>
      ${
        notes
          ? `<p>
        <Link className="underline" href="/notes">
          Open notes
        </Link>
      </p>`
          : ''
      }
    </main>
  );
}
`
  );

}

function emitWeb(ctx: EmitCtx, dep: string): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitWeb requires nest');
  }
  switch (ctx.stack.frontend) {
    case 'tanstack-start':
      emitNestStartWeb(ctx, dep);
      return;
    case 'next':
      break;
    default: {
      const _exhaustive: never = ctx.stack.frontend;
      throw new Error(`unhandled frontend: ${_exhaustive}`);
    }
  }
  if (ctx.stack.api !== 'orpc' || ctx.stack.database === 'none') {
    emitWebShell(ctx, dep);
    return;
  }

  const uiDeps = { '@repo/ui': dep };

  setFile(
    ctx.files,
    'apps/web/package.json',
    JSON.stringify(
      {
        name: 'web',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          '@orpc/client': DEPENDENCY_VERSIONS['@orpc/client'],
          '@orpc/contract': DEPENDENCY_VERSIONS['@orpc/contract'],
          '@orpc/openapi': DEPENDENCY_VERSIONS['@orpc/openapi'],
          '@orpc/tanstack-query': DEPENDENCY_VERSIONS['@orpc/tanstack-query'],
          '@repo/contract': dep,
          ...uiDeps,
          '@tanstack/react-query': DEPENDENCY_VERSIONS['@tanstack/react-query'],
          '@tanstack/react-query-next-experimental':
            DEPENDENCY_VERSIONS['@tanstack/react-query-next-experimental'],
          'better-auth': DEPENDENCY_VERSIONS['better-auth'],
          next: DEPENDENCY_VERSIONS['next'],
          react: DEPENDENCY_VERSIONS['react'],
          'react-dom': DEPENDENCY_VERSIONS['react-dom'],
          'server-only': DEPENDENCY_VERSIONS['server-only'],
        },
        devDependencies: {
          '@repo/typescript-config': dep,
          '@tailwindcss/postcss': DEPENDENCY_VERSIONS['@tailwindcss/postcss'],
          '@types/node': DEPENDENCY_VERSIONS['@types/node'],
          '@types/react': DEPENDENCY_VERSIONS['@types/react'],
          '@types/react-dom': DEPENDENCY_VERSIONS['@types/react-dom'],
          tailwindcss: DEPENDENCY_VERSIONS['tailwindcss'],
          typescript: DEPENDENCY_VERSIONS['typescript'],
        },
      },
      null,
      2
    )
  );

  setFile(
    ctx.files,
    'apps/web/next.config.ts',
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`
  );

  setFile(
    ctx.files,
    'apps/web/app/globals.css',
    `@import "tailwindcss";
`
  );

  setFile(
    ctx.files,
    'apps/web/app/layout.tsx',
    `import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = { title: "${ctx.projectName}" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`
  );

  setFile(
    ctx.files,
    'apps/web/app/page.tsx',
    `import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">${ctx.projectName}</h1>
      <p>
        <Link className="underline" href="/notes">
          Open notes
        </Link>
      </p>
    </main>
  );
}
`
  );

  setFile(
    ctx.files,
    'apps/web/lib/orpc-link.ts',
    `import { OpenAPILink } from "@orpc/openapi/fetch";
import { contract } from "@repo/contract";

export function createOrpcLink(getHeaders?: () => Promise<Record<string, string>>) {
  return new OpenAPILink(contract, {
    url: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3333",
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
    'apps/web/lib/orpc.ts',
    `"use client";

import { createORPCClient } from "@orpc/client";
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

  setFile(
    ctx.files,
    'apps/web/lib/orpc.server.ts',
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
    'apps/web/lib/query-client.ts',
    `import { QueryClient } from "@tanstack/react-query";

export function getQueryClient() {
  return new QueryClient();
}
`
  );

  setFile(
    ctx.files,
    'apps/web/app/providers.tsx',
    `"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function Providers(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
`
  );

  setFile(
    ctx.files,
    'apps/web/lib/auth-client.ts',
    `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3333",
});
`
  );

  setFile(
    ctx.files,
    'apps/web/app/login/page.tsx',
    `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      return;
    }
    router.push("/notes");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        ) : null}
        <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit">{mode === "signin" ? "Sign in" : "Sign up"}</button>
      </form>
    </main>
  );
}
`
  );
}
