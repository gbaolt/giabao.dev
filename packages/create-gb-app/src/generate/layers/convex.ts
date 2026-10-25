import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { addReadmeSection } from '../project-model';

export function emitConvex(ctx: EmitCtx): void {
  const isNext = ctx.stack.frontend === 'next';
  const authed = ctx.stack.auth === 'clerk';
  ctx.pkg.dependencies.convex = DEPENDENCY_VERSIONS['convex'];
  ctx.pkg.scripts.dev = isNext ? 'next dev' : 'vite dev';
  ctx.pkg.scripts['convex:dev'] = 'convex dev';
  ctx.pkg.scripts['convex:codegen'] = 'convex codegen';

  setFile(
    ctx.files,
    'convex/schema.ts',
    `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    title: v.string(),
    body: v.string(),
    ${authed ? 'userId: v.string(),' : ''}
  })${authed ? '.index("by_user", ["userId"])' : ''},
});
`
  );

  if (authed)
    setFile(
      ctx.files,
      'convex/auth.config.ts',
      `export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
`
    );

  const env =
    `${isNext ? 'NEXT_PUBLIC' : 'VITE'}_CONVEX_URL="https://your-deployment.convex.cloud"\n` +
    (authed
      ? `${isNext ? 'NEXT_PUBLIC' : 'VITE'}_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"\nCLERK_SECRET_KEY="sk_test_replace_me"\nCLERK_JWT_ISSUER_DOMAIN="https://your-clerk-domain"\n`
      : '');
  setFile(ctx.files, '.env', env);
  setFile(ctx.files, '.env.example', env);
  if (!authed)
    setFile(
      ctx.files,
      ctx.layout.providersFile,
      `"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(${isNext ? 'process.env.NEXT_PUBLIC_CONVEX_URL!' : 'import.meta.env.VITE_CONVEX_URL as string'});

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`
    );
  addReadmeSection(
    ctx.project,
    'configuration-notes',
    `Run convex:dev to configure your own deployment and generate convex/_generated before typechecking or starting the frontend. Keep convex:dev running alongside dev. Set ${isNext ? 'NEXT_PUBLIC_CONVEX_URL' : 'VITE_CONVEX_URL'} in .env.local to your deployment URL. Run convex:codegen when generated APIs need refreshing. ${authed ? 'Configure the Clerk convex JWT template and set CLERK_JWT_ISSUER_DOMAIN in the Convex deployment environment.' : 'Without authentication, Notes are shared by all users.'}`
  );
}
