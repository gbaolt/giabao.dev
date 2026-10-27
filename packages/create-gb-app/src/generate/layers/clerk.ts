import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { addDependencies, addEnv, setProviders } from '../project-model';

// Clerk validates the key format at build time; this decodes to a placeholder host.
export const CLERK_PLACEHOLDER_PUBLISHABLE_KEY =
  'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk';

export function emitClerk(ctx: EmitCtx): void {
  if (ctx.stack.backend === 'convex') {
    const dependency =
      ctx.stack.frontend === 'tanstack-start'
        ? '@clerk/clerk-react'
        : '@clerk/nextjs';
    ctx.pkg.dependencies[dependency] = DEPENDENCY_VERSIONS[dependency];
    ctx.pkg.dependencies.convex = DEPENDENCY_VERSIONS.convex;
    emitStartClerkConvexProviders(ctx);
    return;
  }

  // With a database, the database module writes these beside its URL.
  if (ctx.stack.database === 'none')
    addEnv(ctx.project, {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: CLERK_PLACEHOLDER_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: 'sk_test_replace_me',
    });

  if (ctx.layout.backendRoot === 'apps/server') {
    // The server adapters mount the middleware these SDKs provide.
    const serverSdk =
      ctx.stack.backend === 'nest' ? '@clerk/express' : '@hono/clerk-auth';
    const webSdk =
      ctx.stack.frontend === 'next'
        ? '@clerk/nextjs'
        : '@clerk/tanstack-react-start';
    addDependencies(ctx.project, ctx.layout.backendManifest!, {
      [serverSdk]: DEPENDENCY_VERSIONS[serverSdk],
    });
    addDependencies(ctx.project, ctx.layout.frontendManifest, {
      [webSdk]: DEPENDENCY_VERSIONS[webSdk],
    });
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

function emitStartClerkConvexProviders(ctx: EmitCtx): void {
  const start = ctx.stack.frontend === 'tanstack-start';
  setProviders(
    ctx.project,
    `"use client";

import { ClerkProvider, useAuth } from "${start ? '@clerk/clerk-react' : '@clerk/nextjs'}";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(${start ? 'import.meta.env.VITE_CONVEX_URL as string' : 'process.env.NEXT_PUBLIC_CONVEX_URL as string'});

export function Providers(props: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={${start ? 'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string' : 'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string'}}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {props.children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
`
  );
}
