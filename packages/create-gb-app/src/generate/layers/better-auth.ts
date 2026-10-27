import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { joinPath } from '../layout';
import {
  addDependencies,
  authPluginImports,
  setAuthConfig,
} from '../project-model';
import { SERVER_URL, WEB_ORIGIN } from './server-workspace';
import { emitStartOrpcAuth } from './start-orpc-auth';

/** Better Auth's adapter provider name for the Stack's database and ORM. */
function adapterProvider(ctx: EmitCtx): string {
  if (ctx.stack.backend === 'convex') throw new Error('convex has no ORM');
  const { database, orm } = ctx.stack;
  if (database === 'sqlite' || database === 'mysql') return database;
  return orm === 'drizzle' ? 'pg' : 'postgresql';
}

// A separate server owns the auth config; the web app signs in against it.
function emitServerAuth(ctx: EmitCtx): void {
  const drizzle = ctx.stack.backend !== 'convex' && ctx.stack.orm === 'drizzle';
  const provider = adapterProvider(ctx);
  addDependencies(ctx.project, ctx.layout.backendManifest!, {
    'better-auth': DEPENDENCY_VERSIONS['better-auth'],
  });
  setAuthConfig(ctx.project, {
    path: ctx.layout.authFile,
    render: (plugins) => `import { betterAuth } from "better-auth";
${authPluginImports(plugins, '"')}${
      drizzle
        ? `import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";`
        : `import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";`
    }

export const auth = betterAuth({
${plugins.length > 0 ? `  plugins: [\n${plugins.map((plugin) => `    ${plugin.call},\n`).join('')}  ],\n` : ''}  database: ${drizzle ? `drizzleAdapter(db, { schema, provider: "${provider}" })` : `prismaAdapter(prisma, { provider: "${provider}" })`},
  emailAndPassword: { enabled: true },
  trustedOrigins: ["${WEB_ORIGIN}"],
  baseURL: "${SERVER_URL}",
});
`,
  });

  const env =
    ctx.stack.frontend === 'next'
      ? 'process.env.NEXT_PUBLIC_SERVER_URL'
      : 'import.meta.env.VITE_SERVER_URL';
  addDependencies(ctx.project, ctx.layout.frontendManifest, {
    'better-auth': DEPENDENCY_VERSIONS['better-auth'],
  });
  setFile(
    ctx.files,
    joinPath(ctx.layout.libDir, 'auth-client.ts'),
    `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: ${env} ?? "${SERVER_URL}",
});
`
  );
}

export function emitBetterAuth(ctx: EmitCtx): void {
  if (ctx.layout.backendRoot === 'apps/server') {
    emitServerAuth(ctx);
    return;
  }
  ctx.pkg.dependencies['better-auth'] = DEPENDENCY_VERSIONS['better-auth'];

  if (ctx.stack.backend === 'convex') {
    ctx.pkg.dependencies['@convex-dev/better-auth'] =
      DEPENDENCY_VERSIONS['@convex-dev/better-auth'];
    setFile(
      ctx.files,
      'convex/auth.config.ts',
      `import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
`
    );
    setAuthConfig(ctx.project, {
      path: 'convex/betterAuth.ts',
      render: (plugins) => `import { betterAuth } from 'better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
${authPluginImports(plugins, "'")}import authConfig from './auth.config';

export const auth = betterAuth({
  plugins: [${plugins.map((plugin) => `\n    ${plugin.call}, `).join('')}convex({ authConfig })],
});
`,
    });
    return;
  }

  const start = ctx.stack.frontend === 'tanstack-start';
  const authPath = ctx.layout.authFile;
  const pluginImport = start
    ? `import { tanstackStartCookies } from 'better-auth/tanstack-start';`
    : `import { nextCookies } from 'better-auth/next-js';`;
  const pluginCall = start ? 'tanstackStartCookies()' : 'nextCookies()';
  const drizzle = ctx.stack.orm === 'drizzle';
  const adapterImport = drizzle
    ? `import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';`
    : `import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';`;
  const adapterCall = drizzle
    ? `drizzleAdapter(db, {
    schema,
    provider: '${adapterProvider(ctx)}',
  })`
    : `prismaAdapter(prisma, {
    provider: '${adapterProvider(ctx)}',
  })`;

  setAuthConfig(ctx.project, {
    path: authPath,
    render: (plugins) => `import { betterAuth } from 'better-auth';
${authPluginImports(plugins, "'")}${adapterImport}
${pluginImport}

export const auth = betterAuth({
  database: ${adapterCall},
  emailAndPassword: {
    enabled: true,
  },
  plugins: [${plugins.map((plugin) => `\n    ${plugin.call}, `).join('')}${pluginCall}],
});
`,
  });

  if (start) {
    setFile(
      ctx.files,
      'src/lib/auth-client.ts',
      `import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
`
    );
    if (ctx.stack.backend === 'self' && ctx.stack.api === 'orpc')
      emitStartOrpcAuth(ctx);
    return;
  }

  setFile(
    ctx.files,
    'lib/auth-client.ts',
    `import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
`
  );

  setFile(
    ctx.files,
    'app/api/auth/[...all]/route.ts',
    `import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
`
  );
}
