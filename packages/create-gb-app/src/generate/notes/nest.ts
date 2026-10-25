import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { SERVER_URL } from '../layers/server-workspace';
import { notesForm, restCreate } from './form';
import { NEXT_SERVER_NOTES_PAGE } from './next-page';
import { notesRepository } from './repository';

export function emitNestNotes(ctx: EmitCtx): void {
  if (ctx.stack.backend !== 'nest' || ctx.stack.database === 'none') return;
  const start = ctx.stack.frontend === 'tanstack-start';
  if (ctx.stack.api === 'none') {
    emitRestController(ctx);
    if (start)
      setFile(ctx.files, 'apps/web/src/routes/notes.tsx', startRestRoute(ctx));
    else emitNextRestClient(ctx);
    return;
  }
  if (ctx.stack.api === 'orpc') {
    if (ctx.stack.auth === 'clerk') emitClerkOrpcController(ctx);
    else emitOrpcController(ctx);
    if (start)
      setFile(ctx.files, 'apps/web/src/routes/notes.tsx', startOrpcRoute(ctx));
    else emitNextOrpcClient(ctx);
  }
}

function emitRestController(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  const authed = ctx.stack.auth === 'better-auth';
  const sessionLookup = authed
    ? `import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
${repo.importFrom('"', './', '.js')}

async function requireUserId(request: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    throw new UnauthorizedException();
  }
  return session.user.id;
}
`
    : `${repo.importFrom('"', './', '.js')}
`;

  setFile(
    ctx.files,
    'apps/server/src/notes.controller.ts',
    `import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post${authed ? ', Req, UnauthorizedException' : ''} } from "@nestjs/common";
import { noteInputSchema } from "@repo/validation";
${authed ? `import type { Request } from "express";\n` : ''}${sessionLookup}
function parseNote(input: unknown) {
  const parsed = noteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
  }
  return parsed.data;
}

@Controller("notes")
export class NotesController {
  @Get()
  async list(${authed ? '@Req() request: Request' : ''}) {
    ${authed ? 'const userId = await requireUserId(request);' : ''}
    return ${repo.list}({
      ${authed ? 'where: { userId },' : ''}
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(${authed ? '@Req() request: Request, ' : ''}@Body() body: unknown) {
    ${authed ? 'const userId = await requireUserId(request);' : ''}
    const note = parseNote(body);
    return ${repo.create}({
      data: {
        title: note.title,
        body: note.body,
        ${authed ? 'userId,' : ''}
      },
    });
  }

  @Patch(":id")
  async update(
    ${authed ? '@Req() request: Request, ' : ''}@Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseNote(body);
    ${authed ? `const userId = await requireUserId(request);\n    const note = await ${repo.find}({ where: { id, userId } });\n    if (!note) {\n      throw new Error("NOT_FOUND");\n    }\n    ` : ''}return ${repo.update}({
      where: { id${authed ? ': note.id' : ''} },
      data: { title: parsed.title, body: parsed.body },
    });
  }

  @Delete(":id")
  async remove(${authed ? '@Req() request: Request, ' : ''}@Param("id") id: string) {
    ${authed ? `const userId = await requireUserId(request);\n    const note = await ${repo.find}({ where: { id, userId } });\n    if (!note) {\n      throw new Error("NOT_FOUND");\n    }\n    ` : ''}await ${repo.remove}({ where: { id${authed ? ': note.id' : ''} } });
    return { ok: true };
  }
}
`
  );
}

function emitOrpcController(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  setFile(
    ctx.files,
    'apps/server/src/notes.controller.ts',
    `import { Controller } from "@nestjs/common";
import { Implement } from "@orpc/nest";
import { ORPCError, implement } from "@orpc/server";
import { contract } from "@repo/contract";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "./auth.js";
${repo.importFrom('"', './', '.js')}

@Controller()
export class NotesController {
  @Implement(contract.me)
  me() {
    return implement(contract.me)
      .$context<{ request: Request }>()
      .handler(async ({ context }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(context.request.headers),
        });
        if (!session) {
          throw new ORPCError("UNAUTHORIZED");
        }
        return session.user;
      });
  }

  @Implement(contract.notes.list)
  list() {
    return implement(contract.notes.list)
      .$context<{ request: Request }>()
      .handler(async ({ context }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(context.request.headers),
        });
        if (!session) {
          throw new ORPCError("UNAUTHORIZED");
        }
        return ${repo.list}({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
        });
      });
  }

  @Implement(contract.notes.create)
  create() {
    return implement(contract.notes.create)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(context.request.headers),
        });
        if (!session) {
          throw new ORPCError("UNAUTHORIZED");
        }
        return ${repo.create}({
          data: {
            title: input.title,
            body: input.body,
            userId: session.user.id,
          },
        });
      });
  }

  @Implement(contract.notes.update)
  update() {
    return implement(contract.notes.update)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(context.request.headers),
        });
        if (!session) {
          throw new ORPCError("UNAUTHORIZED");
        }
        const note = await ${repo.find}({
          where: { id: input.id, userId: session.user.id },
        });
        if (!note) {
          throw new ORPCError("NOT_FOUND");
        }
        return ${repo.update}({
          where: { id: note.id },
          data: { title: input.title, body: input.body },
        });
      });
  }

  @Implement(contract.notes.delete)
  remove() {
    return implement(contract.notes.delete)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(context.request.headers),
        });
        if (!session) {
          throw new ORPCError("UNAUTHORIZED");
        }
        const note = await ${repo.find}({
          where: { id: input.id, userId: session.user.id },
        });
        if (!note) {
          throw new ORPCError("NOT_FOUND");
        }
        await ${repo.remove}({ where: { id: note.id } });
        return { ok: true as const };
      });
  }
}
`
  );
}

function emitClerkOrpcController(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  setFile(
    ctx.files,
    'apps/server/src/notes.controller.ts',
    `import { Controller } from "@nestjs/common";
import { Implement } from "@orpc/nest";
import { ORPCError, implement } from "@orpc/server";
import { contract } from "@repo/contract";
import type { Request } from "express";
import { getAuth } from "@clerk/express";
${repo.importFrom('"', './')}

function requireUserId(request: Request) {
  const userId = getAuth(request).userId;
  if (!userId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return userId;
}

@Controller()
export class NotesController {
  @Implement(contract.me)
  me() {
    return implement(contract.me)
      .$context<{ request: Request }>()
      .handler(async ({ context }) => {
        return { id: requireUserId(context.request) };
      });
  }

  @Implement(contract.notes.list)
  list() {
    return implement(contract.notes.list)
      .$context<{ request: Request }>()
      .handler(async ({ context }) => {
        const userId = requireUserId(context.request);
        return ${repo.list}({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
      });
  }

  @Implement(contract.notes.create)
  create() {
    return implement(contract.notes.create)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const userId = requireUserId(context.request);
        return ${repo.create}({
          data: {
            title: input.title,
            body: input.body,
            userId,
          },
        });
      });
  }

  @Implement(contract.notes.update)
  update() {
    return implement(contract.notes.update)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const userId = requireUserId(context.request);
        const note = await ${repo.find}({
          where: { id: input.id, userId },
        });
        if (!note) {
          throw new ORPCError("NOT_FOUND");
        }
        return ${repo.update}({
          where: { id: note.id },
          data: { title: input.title, body: input.body },
        });
      });
  }

  @Implement(contract.notes.delete)
  remove() {
    return implement(contract.notes.delete)
      .$context<{ request: Request }>()
      .handler(async ({ input, context }) => {
        const userId = requireUserId(context.request);
        const note = await ${repo.find}({
          where: { id: input.id, userId },
        });
        if (!note) {
          throw new ORPCError("NOT_FOUND");
        }
        await ${repo.remove}({ where: { id: note.id } });
        return { ok: true as const };
      });
  }
}
`
  );
}

function startOrpcRoute(ctx: EmitCtx): string {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  return `${inline ? 'import { noteInputSchema } from "@repo/validation";\nimport { useState } from "react";\n' : ''}import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
${inline ? 'import { Button } from "@repo/ui/button";\n' : ''}import { Card } from "@repo/ui/card";${inline ? '\nimport { Input } from "@repo/ui/input";' : form.importLine('"')}

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {
  const queryClient = useQueryClient();${
    inline
      ? `
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");`
      : ''
  }
  const notes = useQuery(orpc.notes.list.queryOptions());
  const create = useMutation(
    orpc.notes.create.mutationOptions({
      onSuccess: async () => {${
        inline
          ? `
        setTitle("");
        setBody("");`
          : ''
      }
        await queryClient.invalidateQueries();
      },
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <Link className="text-sm underline" to="/login">
          Login
        </Link>
      </div>
      ${
        inline
          ? `<form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = noteInputSchema.safeParse({ title, body });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid note");
            return;
          }
          setError(null);
          create.mutate(parsed.data);
        }}
      >
        <Input name="title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Input name="body" placeholder="Body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit" disabled={create.isPending}>Add note</Button>
      </form>
      {error || create.error?.message ? <p role="alert" className="text-sm text-destructive">{error || create.error?.message}</p> : null}`
          : form.element(['await create.mutateAsync(input);'])
      }
      <ul className="flex flex-col gap-3">
        {(notes.data ?? []).map((note) => (
          <li key={note.id}>
            <Card className="p-4">
              <h2 className="font-medium">{note.title}</h2>
              <p className="text-sm opacity-80">{note.body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
`;
}

// Shared by the Start and Next REST pages; only the server URL source differs.
function restNotesBody(ctx: EmitCtx, wrapper: 'main' | 'div'): string {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  return `${
    inline
      ? `
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [body, setBody] = useState("");`
      : ''
  }
  const [notes, setNotes] = useState<Note[]>([]);

  return (
    <${wrapper} className="${wrapper === 'main' ? 'mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8' : 'flex flex-col gap-6'}">${wrapper === 'main' ? '\n      <h1 className="text-2xl font-semibold">Notes</h1>' : ''}
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
            const response = await fetch(serverUrl + "/notes", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed.data),
            });
            if (!response.ok) {
              const failure = await response.json().catch(() => null);
              throw new Error(failure?.issues?.[0]?.message ?? failure?.error ?? "Could not save note");
            }
            const listResponse = await fetch(serverUrl + "/notes", { credentials: "include" });
            setNotes(await listResponse.json());
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
          : form.element(restCreate('/notes', true))
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
    </${wrapper}>
  );
}
`;
}

function restImports(ctx: EmitCtx, router: boolean): string {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  return `${inline ? 'import { noteInputSchema } from "@repo/validation";\n' : ''}import { useState } from "react";
${router ? 'import { createFileRoute } from "@tanstack/react-router";\n' : ''}${inline ? 'import { Button } from "@repo/ui/button";\n' : ''}import { Card } from "@repo/ui/card";${inline ? '\nimport { Input } from "@repo/ui/input";' : form.importLine('"')}`;
}

function startRestRoute(ctx: EmitCtx): string {
  return `${restImports(ctx, true)}

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "${SERVER_URL}";

type Note = { id: string; title: string; body: string };

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {${restNotesBody(ctx, 'main')}`;
}

function emitNextRestClient(ctx: EmitCtx): void {
  setFile(
    ctx.files,
    'apps/web/app/notes/notes-client.tsx',
    `"use client";

${restImports(ctx, false)}

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "${SERVER_URL}";

type Note = { id: string; title: string; body: string };

export function NotesClient() {${restNotesBody(ctx, 'div')}`
  );

  setFile(ctx.files, 'apps/web/app/notes/page.tsx', NEXT_SERVER_NOTES_PAGE);
}

function emitNextOrpcClient(ctx: EmitCtx): void {
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  setFile(
    ctx.files,
    'apps/web/app/notes/notes-client.tsx',
    `"use client";

${inline ? 'import { noteInputSchema } from "@repo/validation";\nimport { useState } from "react";\n' : ''}import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
${inline ? 'import { Button } from "@repo/ui/button";\n' : ''}import { Card } from "@repo/ui/card";${inline ? '\nimport { Input } from "@repo/ui/input";' : form.importLine('"')}

export function NotesClient() {
  const queryClient = useQueryClient();${
    inline
      ? `
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");`
      : ''
  }
  const notes = useQuery(orpc.notes.list.queryOptions());
  const create = useMutation(
    orpc.notes.create.mutationOptions({
      onSuccess: async () => {${
        inline
          ? `
        setTitle("");
        setBody("");`
          : ''
      }
        await queryClient.invalidateQueries();
      },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      ${
        inline
          ? `<form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = noteInputSchema.safeParse({ title, body });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid note");
            return;
          }
          setError(null);
          create.mutate(parsed.data);
        }}
      >
        <Input name="title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Input name="body" placeholder="Body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit" disabled={create.isPending}>Add note</Button>
      </form>
      {error || create.error?.message ? <p role="alert" className="text-sm text-destructive">{error || create.error?.message}</p> : null}`
          : form.element(['await create.mutateAsync(input);'])
      }
      <ul className="flex flex-col gap-3">
        {(notes.data ?? []).map((note) => (
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
`
  );

  setFile(
    ctx.files,
    'apps/web/app/notes/page.tsx',
    `import Link from "next/link";
import { NotesClient } from "./notes-client";

export default function NotesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <Link className="text-sm underline" href="/login">
          Login
        </Link>
      </div>
      <NotesClient />
    </main>
  );
}
`
  );
}
