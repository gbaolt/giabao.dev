import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { GenerateError } from '../errors';
import { setFile } from '../files';
import {
  emitServerWorkspace,
  SERVER_LISTEN_PORT,
  WEB_ORIGIN,
  writeServerManifest,
} from './server-workspace';

export function emitNest(ctx: EmitCtx): void {
  if (ctx.stack.backend !== 'nest') {
    throw new Error('emitNest requires nest');
  }
  const stack = ctx.stack;
  if (stack.api === 'trpc') {
    throw new GenerateError(
      'nest-trpc',
      'nest trpc generate is not implemented yet'
    );
  }
  emitServerWorkspace(ctx, {
    nodeNext: true,
    tsconfig: {
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
    emit: (context, dep) => {
      if (stack.database === 'none') {
        emitShellServer(context, dep);
      } else if (stack.api === 'none') {
        emitRestServer(context, dep);
      } else {
        emitServer(context, dep);
      }
    },
  });
}

function emitShellServer(ctx: EmitCtx, dep: string): void {
  writeServerManifest(ctx, {
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
  });

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(${SERVER_LISTEN_PORT});
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

  writeServerManifest(ctx, {
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
  });

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule${authed ? ', { bodyParser: false }' : ''});

  app.enableCors({
    origin: ["${WEB_ORIGIN}"],
    credentials: true,
  });

  await app.listen(${SERVER_LISTEN_PORT});
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
  trustedOrigins: ["${WEB_ORIGIN}"],
});
`
    );
  }
}

function emitServer(ctx: EmitCtx, dep: string): void {
  writeServerManifest(ctx, {
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
  });

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
    origin: ["${WEB_ORIGIN}"],
    credentials: true,
  });

  await app.listen(${SERVER_LISTEN_PORT});
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
  trustedOrigins: ["${WEB_ORIGIN}"],
});
`
  );
}
