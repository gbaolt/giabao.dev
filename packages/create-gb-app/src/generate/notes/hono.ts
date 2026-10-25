import type { EmitCtx } from '../../types/generate';
import type { HonoStack } from '../../types/stack';
import { setFile } from '../files';
import { SERVER_URL } from '../layers/server-workspace';
import { notesForm, restCreate } from './form';
import { NEXT_SERVER_NOTES_PAGE } from './next-page';
import { notesRepository } from './repository';

export function emitHonoNotes(ctx: EmitCtx): void {
  const { stack } = ctx;
  if (stack.backend !== 'hono' || stack.database === 'none') return;
  emitServerNotes(ctx, stack);
  if (stack.api === 'orpc') emitOrpcRouter(ctx, stack);
  if (stack.frontend === 'next') {
    setFile(
      ctx.files,
      'apps/web/app/notes/notes-client.tsx',
      nextNotesClient(ctx, stack)
    );
    setFile(ctx.files, 'apps/web/app/notes/page.tsx', NEXT_SERVER_NOTES_PAGE);
  } else {
    setFile(
      ctx.files,
      'apps/web/src/routes/notes.tsx',
      startNotesRoute(ctx, stack)
    );
  }
}

function emitServerNotes(ctx: EmitCtx, stack: HonoStack): void {
  const authed = stack.auth !== 'none';
  if (stack.orm === 'drizzle') {
    setFile(
      ctx.files,
      'apps/server/src/notes.ts',
      `import { noteInputSchema } from "@repo/validation";
import { notesStore } from "./notes-store";
function scope(userId: string | null) {
  ${authed ? 'if (!userId) throw new Error("UNAUTHORIZED"); return { userId };' : 'return {};'}
}
export async function listNotes(userId: string | null) {
  return notesStore.list({ where: scope(userId) });
}
export async function createNote(userId: string | null, input: { title: string; body: string }) {
  const user = scope(userId);
  const note = noteInputSchema.parse(input);
  return notesStore.create({ data: { ...note, ...user } });
}
export async function updateNote(userId: string | null, input: { id: string; title: string; body: string }) {
  const where = { id: input.id, ...scope(userId) };
  if (!await notesStore.find({ where })) throw new Error("NOT_FOUND");
  return notesStore.update({ where, data: noteInputSchema.parse(input) });
}
export async function removeNote(userId: string | null, id: string): Promise<{ ok: true }> {
  const where = { id, ...scope(userId) };
  if (!await notesStore.find({ where })) throw new Error("NOT_FOUND");
  await notesStore.remove({ where });
  return { ok: true };
}
`
    );
    return;
  }

  const repo = notesRepository(stack);
  const scope = authed ? 'where: { userId: userId ?? "" }' : '';
  setFile(
    ctx.files,
    'apps/server/src/notes.ts',
    `import { noteInputSchema } from "@repo/validation";
${repo.importFrom('"', './')}

export async function listNotes(userId: string | null) {
  ${authed ? 'if (!userId) {\n    return [];\n  }\n  ' : ''}return ${repo.list}({
    ${scope ? `${scope},` : ''}
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(
  userId: string | null,
  input: { title: string; body: string },
) {
  const note = noteInputSchema.parse(input);
  return ${repo.create}({
    data: {
      title: note.title,
      body: note.body,
      ${authed ? 'userId: userId ?? "",' : ''}
    },
  });
}

export async function updateNote(
  userId: string | null,
  input: { id: string; title: string; body: string },
) {
  const parsed = noteInputSchema.parse(input);
  ${authed ? `const note = await ${repo.find}({ where: { id: input.id, userId: userId ?? "" } });\n  if (!note) {\n    throw new Error("NOT_FOUND");\n  }\n  ` : ''}return ${repo.update}({
    where: { id: ${authed ? 'note.id' : 'input.id'} },
    data: { title: parsed.title, body: parsed.body },
  });
}

export async function removeNote(userId: string | null, id: string) {
  ${authed ? `const note = await ${repo.find}({ where: { id, userId: userId ?? "" } });\n  if (!note) {\n    throw new Error("NOT_FOUND");\n  }\n  await ${repo.remove}({ where: { id: note.id } });` : `await ${repo.remove}({ where: { id } });`}
  return { ok: true as const };
}
`
  );
}

function emitOrpcRouter(ctx: EmitCtx, stack: HonoStack): void {
  const authed = stack.auth !== 'none';
  const meBody =
    stack.auth === 'better-auth'
      ? `const session = await auth.api.getSession({ headers: context.headers });
    if (!session) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return session.user;`
      : authed
        ? `if (!context.userId) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return { id: context.userId, email: "user@example.com", name: "User" };`
        : `return { id: "public", email: "public@example.com", name: "Public" };`;
  const guard = authed
    ? `if (!context.userId) {
      throw new ORPCError("UNAUTHORIZED");
    }
    `
    : '';
  const authImport =
    stack.auth === 'better-auth' ? `import { auth } from "./auth";\n` : '';

  setFile(
    ctx.files,
    'apps/server/src/orpc.ts',
    `import { ORPCError, implement } from "@orpc/server";
import { contract } from "@repo/contract";
${authImport}import { createNote, listNotes, removeNote, updateNote } from "./notes";

const base = implement(contract).$context<{ headers: Headers; userId: string | null }>();

export const router = base.router({
  me: base.me.handler(async ({ context }) => {
    ${meBody}
  }),
  notes: {
    list: base.notes.list.handler(async ({ context }) => {
      ${guard}return listNotes(context.userId);
    }),
    create: base.notes.create.handler(async ({ context, input }) => {
      ${guard}return createNote(context.userId, input);
    }),
    update: base.notes.update.handler(async ({ context, input }) => {
      ${guard}return updateNote(context.userId, input);
    }),
    delete: base.notes.delete.handler(async ({ context, input }) => {
      ${guard}return removeNote(context.userId, input.id);
    }),
  },
});
`
  );
}

function notesHttpPath(stack: HonoStack): string {
  return stack.api === 'orpc' ? '/api/notes' : '/notes';
}

const TRPC_CLIENT = (
  env: string
) => `const serverUrl = ${env} ?? "${SERVER_URL}";
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: serverUrl + "/trpc",
      fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
    }),
  ],
});`;

function nextNotesClient(ctx: EmitCtx, stack: HonoStack): string {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  const trpc = stack.api === 'trpc';
  const path = notesHttpPath(stack);
  const states = inline
    ? `
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [body, setBody] = useState("");`
    : '';
  const create = trpc
    ? `            await client.notes.create.mutate(parsed.data);
            setNotes(await client.notes.list.query());`
    : `            const response = await fetch(serverUrl + "${path}", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
            });
            if (!response.ok) {
              const failure = await response.json().catch(() => null);
              throw new Error(failure?.issues?.[0]?.message ?? failure?.error ?? "Could not save note");
            }
            const listResponse = await fetch(serverUrl + "${path}", { credentials: "include" });
            setNotes(await listResponse.json());`;
  const submit = trpc
    ? [
        'await client.notes.create.mutate(input);',
        'setNotes(await client.notes.list.query());',
      ]
    : restCreate(path, true);
  return `"use client";

${inline ? 'import { noteInputSchema } from "@repo/validation";\n' : ''}import { useState } from "react";
${trpc ? 'import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";\nimport type { AppRouter } from "@repo/contract";\n' : ''}${inline ? 'import { Button } from "@repo/ui/button";\n' : ''}import { Card } from "@repo/ui/card";${inline ? '\nimport { Input } from "@repo/ui/input";' : form.importLine('"')}

${trpc ? TRPC_CLIENT('process.env.NEXT_PUBLIC_SERVER_URL') : `const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "${SERVER_URL}";`}

type Note = { id: string; title: string; body: string };

export function NotesClient() {${states}
  const [notes, setNotes] = useState<Note[]>([]);

  return (
    <div className="flex flex-col gap-6">
      ${
        inline
          ? `<form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = noteInputSchema.safeParse({ title, body });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid note");
            return;
          }
          setError(null);
          setPending(true);
          try {
${create}
            setTitle("");
            setBody("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save note");
          } finally {
            setPending(false);
          }
        }}
      >
        <Input name="title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Input name="body" placeholder="Body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit" disabled={pending}>Add note</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}`
          : form.element(submit)
      }
      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <Card className="p-4">
              <h2 className="font-medium">{note.title}</h2>
              <p className="text-sm opacity-80">{note.body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;
}

function startNotesRoute(ctx: EmitCtx, stack: HonoStack): string {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  const trpc = stack.api === 'trpc';
  const create = trpc
    ? `            await client.notes.create.mutate(parsed.data);`
    : `            const response = await fetch(serverUrl + "${notesHttpPath(stack)}", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
            });
            if (!response.ok) {
              const failure = await response.json().catch(() => null);
              throw new Error(failure?.issues?.[0]?.message ?? failure?.error ?? "Could not save note");
            }`;
  const submit = trpc
    ? ['await client.notes.create.mutate(input);']
    : restCreate(notesHttpPath(stack), false);
  return `import { createFileRoute } from "@tanstack/react-router";${inline ? '\nimport { noteInputSchema } from "@repo/validation";\nimport { useState } from "react";' : ''}${trpc ? '\nimport { createTRPCProxyClient, httpBatchLink } from "@trpc/client";\nimport type { AppRouter } from "@repo/contract";' : ''}${inline ? '\nimport { Button } from "@repo/ui/button";\nimport { Input } from "@repo/ui/input";' : form.importLine('"')}

${trpc ? TRPC_CLIENT('import.meta.env.VITE_SERVER_URL') : `const serverUrl = import.meta.env.VITE_SERVER_URL ?? "${SERVER_URL}";`}

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {${
    inline
      ? `
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);`
      : ''
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      ${
        inline
          ? `<form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = noteInputSchema.safeParse({ title, body: "" });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid note");
            return;
          }
          setError(null);
          setPending(true);
          try {
${create}
            setTitle("");

          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save note");
          } finally {
            setPending(false);
          }
        }}
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <Button type="submit" disabled={pending}>Add note</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}`
          : form.element(submit)
      }
    </main>
  );
}
`;
}
