import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';

export function emitStartOrpcAuth(ctx: EmitCtx): void {
  setFile(
    ctx.files,
    'src/routes/api/auth.$.ts',
    `import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: {
    GET: ({ request }) => auth.handler(request),
    POST: ({ request }) => auth.handler(request),
  } },
});
`
  );
  setFile(
    ctx.files,
    'src/lib/reset-session.ts',
    `import type { QueryClient } from "@tanstack/react-query";

export async function resetSession(queryClient: QueryClient, destination: "/login" | "/notes") {
  await queryClient.cancelQueries();
  queryClient.clear();
  // A fresh document also discards route state and responses from the old identity.
  window.location.replace(destination);
}
`
  );
}

export function startOrpcLoginRoute(projectNameLiteral: string): string {
  return `import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/login-form";
import { resetSession } from "../lib/reset-session";

export const Route = createFileRoute("/login")({ component: LoginPage, headers: () => ({ "Cache-Control": "private, no-store" }) });

function LoginPage() {
  const queryClient = useQueryClient();
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
    <h1 className="text-xl font-semibold">{${projectNameLiteral}}</h1>
    <LoginForm onSuccess={() => { void resetSession(queryClient, "/notes"); }} />
  </main>;
}
`;
}
