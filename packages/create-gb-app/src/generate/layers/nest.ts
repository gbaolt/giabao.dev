import type { NestStack } from '#/types/stack';

import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { GenerateError } from '../errors';
import { setFile, sortRecord } from '../files';
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
    emit: (context, dep) => emitServer(context, stack, dep),
  });
}

function emitServer(ctx: EmitCtx, stack: NestStack, dep: string): void {
  const notes = stack.database !== 'none';
  const orpc = notes && stack.api === 'orpc';
  const betterAuth = notes && stack.auth === 'better-auth';
  const clerk = stack.auth === 'clerk';

  const dependencies: Record<string, string> = {
    '@nestjs/common': DEPENDENCY_VERSIONS['@nestjs/common'],
    '@nestjs/core': DEPENDENCY_VERSIONS['@nestjs/core'],
    '@nestjs/platform-express': DEPENDENCY_VERSIONS['@nestjs/platform-express'],
    'reflect-metadata': DEPENDENCY_VERSIONS['reflect-metadata'],
    rxjs: DEPENDENCY_VERSIONS['rxjs'],
  };
  const devDependencies: Record<string, string> = {
    '@repo/typescript-config': dep,
    '@types/express': DEPENDENCY_VERSIONS['@types/express'],
    '@types/node': DEPENDENCY_VERSIONS['@types/node'],
    tsx: DEPENDENCY_VERSIONS['tsx'],
    typescript: DEPENDENCY_VERSIONS['typescript'],
  };
  if (orpc) {
    dependencies['@orpc/nest'] = DEPENDENCY_VERSIONS['@orpc/nest'];
    dependencies['@orpc/openapi'] = DEPENDENCY_VERSIONS['@orpc/openapi'];
    dependencies['@orpc/server'] = DEPENDENCY_VERSIONS['@orpc/server'];
    dependencies['@repo/contract'] = dep;
  }
  if (betterAuth)
    dependencies['@thallesp/nestjs-better-auth'] =
      DEPENDENCY_VERSIONS['@thallesp/nestjs-better-auth'];

  writeServerManifest(ctx, {
    scripts: {
      dev: 'tsx watch src/main.ts',
      start: 'node dist/main.js',
      build: 'tsc',
    },
    dependencies: sortRecord(dependencies),
    devDependencies: sortRecord(devDependencies),
  });

  // Better Auth and oRPC parse request bodies themselves.
  const ownBodyParser = betterAuth || orpc;
  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
${clerk ? 'import { clerkMiddleware } from "@clerk/express";\n' : ''}import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule${ownBodyParser ? ', { bodyParser: false }' : ''});
${clerk ? '\n  app.use(clerkMiddleware());' : ''}
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
    appModule(orpc, betterAuth, notes)
  );
}

function appModule(orpc: boolean, betterAuth: boolean, notes: boolean) {
  const imports = [
    orpc
      ? 'import { type ExecutionContext, Module } from "@nestjs/common";'
      : 'import { Module } from "@nestjs/common";',
    ...(orpc ? ['import { ORPCModule } from "@orpc/nest";'] : []),
    ...(betterAuth
      ? ['import { AuthModule } from "@thallesp/nestjs-better-auth";']
      : []),
    ...(orpc ? ['import type { Request } from "express";'] : []),
    ...(betterAuth ? ['import { auth } from "./auth.js";'] : []),
    ...(notes
      ? ['import { NotesController } from "./notes.controller.js";']
      : []),
  ];
  const modules = [
    ...(betterAuth
      ? [
          `    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
      },
    }),`,
        ]
      : []),
    ...(orpc
      ? [
          `    ORPCModule.forRoot({
      context: (ctx: ExecutionContext) => ({
        request: ctx.switchToHttp().getRequest<Request>(),
      }),
    }),`,
        ]
      : []),
  ];
  const options = [
    ...(modules.length ? [`  imports: [\n${modules.join('\n')}\n  ],`] : []),
    ...(notes ? ['  controllers: [NotesController],'] : []),
  ];
  return `${imports.join('\n')}
${
  orpc
    ? `
declare module "@orpc/server" {
  interface DefaultInitialContext {
    request: Request;
  }
}
`
    : ''
}
@Module(${options.length ? `{\n${options.join('\n')}\n}` : '{}'})
export class AppModule {}
`;
}
