import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitClerk(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex') {
    const dependency = ctx.stack.frontend === 'tanstack-start'
      ? '@clerk/clerk-react'
      : '@clerk/nextjs';
    ctx.pkg.dependencies[dependency] = DEPENDENCY_VERSIONS[dependency];
    ctx.pkg.dependencies.convex = DEPENDENCY_VERSIONS.convex;
    emitStartClerkConvexProviders(ctx);
    return;
  }

  if (ctx.stack.backend === 'nest') {
    emitNestClerk(ctx);
    return;
  }

  if (ctx.stack.frontend === 'tanstack-start' && ctx.stack.backend === 'self') {
    ctx.pkg.dependencies['@clerk/tanstack-react-start'] =
      DEPENDENCY_VERSIONS['@clerk/tanstack-react-start'];
    return;
  }

  ctx.pkg.dependencies['@clerk/nextjs'] = DEPENDENCY_VERSIONS['@clerk/nextjs'];
  setFile(
    ctx.files,
    'middleware.ts',
    `import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
`
  );
}

function emitNestClerk(ctx: EmitCtx): void {
  ctx.pkg.dependencies['@clerk/express'] =
    DEPENDENCY_VERSIONS['@clerk/express'];
  const serverPkgPath = 'apps/server/package.json';
  const serverPkgRaw = ctx.files[serverPkgPath];
  if (serverPkgRaw) {
    const serverPkg = JSON.parse(serverPkgRaw) as {
      dependencies: Record<string, string>;
    };
    serverPkg.dependencies['@clerk/express'] =
      DEPENDENCY_VERSIONS['@clerk/express'];
    delete serverPkg.dependencies['@thallesp/nestjs-better-auth'];
    delete serverPkg.dependencies['better-auth'];
    setFile(
      ctx.files,
      serverPkgPath,
      `${JSON.stringify(serverPkg, null, 2)}\n`
    );
  }

  setFile(
    ctx.files,
    'apps/server/src/clerk.ts',
    `import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request } from "express";

export { clerkMiddleware, getAuth };

export function clerkUserId(request: Request) {
  return getAuth(request).userId;
}
`
  );

  setFile(
    ctx.files,
    'apps/server/src/main.ts',
    `import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { clerkMiddleware } from "@clerk/express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(clerkMiddleware());
  app.enableCors({
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  await app.listen(3333);
}

void bootstrap();
`
  );

  // The oRPC module only exists to serve Notes, which needs a database.
  if (
    ctx.stack.backend === 'nest' &&
    (ctx.stack.api !== 'orpc' || ctx.stack.database === 'none')
  ) {
    return;
  }

  setFile(
    ctx.files,
    'apps/server/src/app.module.ts',
    `import { type ExecutionContext, Module } from "@nestjs/common";
import { ORPCModule } from "@orpc/nest";
import type { Request } from "express";
import { NotesController } from "./notes.controller.js";

@Module({
  imports: [
    ORPCModule.forRoot({
      context: (ctx: object) => ({
        request: (ctx as ExecutionContext).switchToHttp().getRequest<Request>(),
      }),
    }),
  ],
  controllers: [NotesController],
})
export class AppModule {}
`
  );
}

function emitStartClerkConvexProviders(ctx: EmitCtx): void {
  const start = ctx.stack.frontend === 'tanstack-start';
  setFile(
    ctx.files,
    ctx.layout.providersFile,
    `"use client";

import { ClerkProvider, useAuth } from "${start ? '@clerk/clerk-react' : '@clerk/nextjs'}";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(${start ? 'import.meta.env.VITE_CONVEX_URL as string' : 'process.env.NEXT_PUBLIC_CONVEX_URL!'});

export function Providers(props: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={${start ? 'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string' : 'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!'}}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {props.children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
`
  );
}
