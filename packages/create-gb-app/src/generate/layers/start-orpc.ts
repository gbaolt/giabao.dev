import type { EmitCtx } from '../../types/generate';
import type { Stack } from '../../types/stack';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { GenerateError } from '../errors';
import { setFile } from '../files';

export function validateStartOrpc(stack: Stack): void {
  if (
    stack.backend !== 'self' ||
    stack.frontend !== 'tanstack-start' ||
    stack.api !== 'orpc'
  )
    return;
  if (
    stack.database !== 'postgres' ||
    stack.orm !== 'prisma' ||
    stack.dbSetup !== 'none' ||
    stack.payments !== 'none' ||
    (stack.auth !== 'none' && stack.auth !== 'better-auth') ||
    stack.structure !== 'single' ||
    stack.form !== 'none'
  ) {
    throw new GenerateError(
      'start-orpc',
      'Start with the built-in oRPC backend currently supports a single application with PostgreSQL, Prisma, auth disabled or Better Auth, no payments, no database setup, and the plain form. Choose that configuration or another API/backend.'
    );
  }
}

export function emitStartOrpc(ctx: EmitCtx): void {
  const authenticated = ctx.stack.auth === 'better-auth';
  for (const name of [
    '@orpc/server',
    '@orpc/client',
    '@orpc/tanstack-query',
    '@tanstack/react-query',
    '@tanstack/react-router-ssr-query',
  ]) {
    ctx.pkg.dependencies[name] = DEPENDENCY_VERSIONS[name];
  }
  setFile(
    ctx.files,
    'src/routes/api/rpc.$.ts',
    `import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";
import { router } from "../../server/router";

const handler = new RPCHandler(router);

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: "/api/rpc",
          context: { headers: request.headers },
        });
        const result = response ?? new Response("Not found", { status: 404 });
        ${authenticated ? 'result.headers.set("Cache-Control", "private, no-store");' : ''}
        return result;
      },
    },
  },
});
`
  );
  setFile(
    ctx.files,
    'src/lib/orpc.ts',
    `import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { router } from "../server/router";

export const client: RouterClient<typeof router> = createIsomorphicFn()
  .server(() => createRouterClient(router, {
    context: () => ({ headers: getRequestHeaders() }),
  }))
  .client((): RouterClient<typeof router> => createORPCClient(new RPCLink({ url: "/api/rpc" })))();

export const orpc = createTanstackQueryUtils(client);
`
  );
  setFile(
    ctx.files,
    'src/router.tsx',
    `import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
`
  );
}
