import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { setProviders } from '../project-model';

export function emitTrpc(ctx: EmitCtx): void {
  ctx.pkg.dependencies['@trpc/server'] = DEPENDENCY_VERSIONS['@trpc/server'];
  ctx.pkg.dependencies['@trpc/client'] = DEPENDENCY_VERSIONS['@trpc/client'];
  ctx.pkg.dependencies['@trpc/react-query'] =
    DEPENDENCY_VERSIONS['@trpc/react-query'];
  ctx.pkg.dependencies['@tanstack/react-query'] =
    DEPENDENCY_VERSIONS['@tanstack/react-query'];
  ctx.pkg.dependencies.zod = DEPENDENCY_VERSIONS['zod'];
  ctx.pkg.dependencies.superjson = DEPENDENCY_VERSIONS['superjson'];

  if (ctx.stack.frontend === 'next') {
    emitTrpcNext(ctx);
    return;
  }

  setFile(
    ctx.files,
    'src/server/trpc.ts',
    `import { initTRPC } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
`
  );

  setFile(
    ctx.files,
    'src/routes/api/trpc.$.ts',
    `import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/router";

function handler({ request }: { request: Request }) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => ({}),
  });
}

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});
`
  );

  setFile(
    ctx.files,
    'src/lib/trpc.ts',
    `import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router";

export const trpc = createTRPCReact<AppRouter>();
`
  );

  setFile(
    ctx.files,
    'src/lib/query-client.ts',
    `import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
`
  );

  setProviders(
    ctx.project,
    `"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";
import { getQueryClient } from "../lib/query-client";
import { trpc } from "../lib/trpc";

export function Providers(props: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
`
  );
}

function emitTrpcNext(ctx: EmitCtx): void {
  const clerk = ctx.stack.auth === 'clerk';
  setFile(
    ctx.files,
    'server/trpc.ts',
    clerk
      ? `import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";

export const createContext = async () => {
  return { auth: await auth() };
};

const t = initTRPC.context<typeof createContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
`
      : `import { initTRPC } from "@trpc/server";
import superjson from "superjson";

export const createContext = async () => ({});

const t = initTRPC.context<typeof createContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
`
  );

  setFile(
    ctx.files,
    'app/api/trpc/[trpc]/route.ts',
    `import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
`
  );

  setFile(
    ctx.files,
    'lib/trpc.ts',
    `import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/router";

export const trpc = createTRPCReact<AppRouter>();
`
  );

  const clerkWrap = ctx.stack.auth === 'clerk';
  setProviders(
    ctx.project,
    `"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
${clerkWrap ? `import { ClerkProvider } from "@clerk/nextjs";` : ''}
import { useState, type ReactNode } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

export function Providers(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );

  const tree = (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </trpc.Provider>
  );

  return ${clerkWrap ? '<ClerkProvider>{tree}</ClerkProvider>' : 'tree'};
}
`
  );
}
