import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { addEnv, addReadmeSection, setProviders } from '../project-model';
import { CLERK_PLACEHOLDER_PUBLISHABLE_KEY } from './clerk';

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

  const publicPrefix = isNext ? 'NEXT_PUBLIC' : 'VITE';
  addEnv(ctx.project, {
    [`${publicPrefix}_CONVEX_URL`]: 'https://your-deployment.convex.cloud',
  });
  if (authed)
    addEnv(ctx.project, {
      [`${publicPrefix}_CLERK_PUBLISHABLE_KEY`]:
        CLERK_PLACEHOLDER_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: 'sk_test_replace_me',
      CLERK_JWT_ISSUER_DOMAIN: 'https://your-clerk-domain',
    });
  if (!authed)
    setProviders(
      ctx.project,
      `"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(${isNext ? 'process.env.NEXT_PUBLIC_CONVEX_URL as string' : 'import.meta.env.VITE_CONVEX_URL as string'});

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`
    );
  emitGeneratedApi(ctx);
  addReadmeSection(
    ctx.project,
    'configuration-notes',
    `Run convex:dev to configure your own deployment; it regenerates convex/_generated from your functions. Keep convex:dev running alongside dev. Set ${isNext ? 'NEXT_PUBLIC_CONVEX_URL' : 'VITE_CONVEX_URL'} in .env.local to your deployment URL. Run convex:codegen when generated APIs need refreshing. ${authed ? 'Configure the Clerk convex JWT template and set CLERK_JWT_ISSUER_DOMAIN in the Convex deployment environment.' : 'Without authentication, Notes are shared by all users.'}`
  );
}

// Codegen needs a logged-in deployment, so ship what `convex codegen` writes for
// these modules; `convex dev` overwrites the same files once a deployment exists.
function emitGeneratedApi(ctx: EmitCtx): void {
  const modules = [
    ...(ctx.stack.auth === 'better-auth' ? ['betterAuth'] : []),
    'notes',
  ];
  const header =
    '/* eslint-disable */\n// Generated code. Run `npx convex dev` to regenerate.\n';
  const builders = [
    ['query', 'QueryBuilder', 'public'],
    ['internalQuery', 'QueryBuilder', 'internal'],
    ['mutation', 'MutationBuilder', 'public'],
    ['internalMutation', 'MutationBuilder', 'internal'],
    ['action', 'ActionBuilder', 'public'],
    ['internalAction', 'ActionBuilder', 'internal'],
  ] as const;
  const generated: Record<string, string> = {
    'api.d.ts': `${header}import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
${modules.map((name) => `import type * as ${name} from "../${name}";`).join('\n')}

declare const fullApi: ApiFromModules<{
${modules.map((name) => `  ${name}: typeof ${name};`).join('\n')}
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
`,
    'api.js': `${header}import { anyApi } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
`,
    'dataModel.d.ts': `${header}import type { DataModelFromSchemaDefinition, DocumentByName, SystemTableNames, TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema";

export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`,
    'server.d.ts': `${header}import type { ActionBuilder, GenericActionCtx, GenericDatabaseReader, GenericDatabaseWriter, GenericMutationCtx, GenericQueryCtx, HttpActionBuilder, MutationBuilder, QueryBuilder } from "convex/server";
import type { DataModel } from "./dataModel";

${builders.map(([name, type, visibility]) => `export declare const ${name}: ${type}<DataModel, "${visibility}">;`).join('\n')}
export declare const httpAction: HttpActionBuilder;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`,
    'server.js': `${header}import { actionGeneric, httpActionGeneric, internalActionGeneric, internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric } from "convex/server";

export const query = queryGeneric;
export const internalQuery = internalQueryGeneric;
export const mutation = mutationGeneric;
export const internalMutation = internalMutationGeneric;
export const action = actionGeneric;
export const internalAction = internalActionGeneric;
export const httpAction = httpActionGeneric;
`,
  };
  for (const [name, source] of Object.entries(generated))
    setFile(ctx.files, `convex/_generated/${name}`, source);
}
