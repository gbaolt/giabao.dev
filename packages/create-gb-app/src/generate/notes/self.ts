import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { notesForm } from './form';
import { notesRepository } from './repository';

export function emitSelfNotes(ctx: EmitCtx): void {
  if (ctx.stack.backend !== 'self' || ctx.stack.database === 'none') return;
  const start = ctx.stack.frontend === 'tanstack-start';
  switch (ctx.stack.api) {
    case 'orpc':
      if (start) emitStartOrpcNotes(ctx);
      else emitNextQueryNotes(ctx, 'orpc');
      return;
    case 'trpc':
      if (start) emitStartTrpcNotes(ctx);
      else emitNextQueryNotes(ctx, 'trpc');
      return;
    case 'none':
      if (start) emitStartServerFnNotes(ctx);
      else emitNextServerActionNotes(ctx);
      return;
    default: {
      const _exhaustive: never = ctx.stack.api;
      throw new Error(`unhandled api: ${_exhaustive}`);
    }
  }
}

const NEXT_NOTES_PAGE = `import Link from 'next/link';
import { NotesClient } from './notes-client';

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
`;

function emitNextQueryNotes(ctx: EmitCtx, transport: 'orpc' | 'trpc'): void {
  const repo = notesRepository(ctx.stack);
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  if (transport === 'orpc') {
    setFile(
      ctx.files,
      'router.ts',
      `import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
${repo.importFrom("'", '@/lib/')}
import { noteInputSchema } from '@/lib/note-validation';

const base = os.$context<{ headers: Headers }>();

const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) {
    throw new ORPCError('UNAUTHORIZED');
  }
  return next({ context: { user: session.user } });
});

export const router = {
  me: authed.handler(async ({ context }) => context.user),
  notes: {
    list: authed.handler(async ({ context }) => {
      return ${repo.list}({
        where: { userId: context.user.id },
        orderBy: { createdAt: 'desc' },
      });
    }),
    create: authed
      .input(noteInputSchema)
      .handler(async ({ input, context }) => {
        return ${repo.create}({
          data: {
            title: input.title,
            body: input.body,
            userId: context.user.id,
          },
        });
      }),
    update: authed
      .input(
        z.object({
          id: z.string(),
          ...noteInputSchema.shape,
        })
      )
      .handler(async ({ input, context }) => {
        const note = await ${repo.find}({
          where: { id: input.id, userId: context.user.id },
        });
        if (!note) {
          throw new ORPCError('NOT_FOUND');
        }
        return ${repo.update}({
          where: { id: note.id },
          data: { title: input.title, body: input.body },
        });
      }),
    delete: authed
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        const note = await ${repo.find}({
          where: { id: input.id, userId: context.user.id },
        });
        if (!note) {
          throw new ORPCError('NOT_FOUND');
        }
        await ${repo.remove}({ where: { id: note.id } });
        return { ok: true };
      }),
  },
};
`
    );
  } else {
    setFile(
      ctx.files,
      'server/router.ts',
      `import { z } from "zod";
${repo.importFrom('"', '@/lib/')}
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  notes: {
    list: publicProcedure.query(async () => {
      return ${repo.list}({ orderBy: { createdAt: "desc" } });
    }),
    create: publicProcedure
      .input(z.object({ title: z.string().min(1), body: z.string() }))
      .mutation(async ({ input }) => {
        return ${repo.create}({ data: input });
      }),
  },
});

export type AppRouter = typeof appRouter;
`
    );
  }

  setFile(ctx.files, 'app/notes/page.tsx', NEXT_NOTES_PAGE);

  const queries =
    transport === 'orpc'
      ? {
          imports: `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc';`,
          client: '  const queryClient = useQueryClient();',
          list: '  const notes = useQuery(orpc.notes.list.queryOptions());',
          create:
            '  const create = useMutation(\n    orpc.notes.create.mutationOptions({',
          close: '    })\n  );',
          invalidate: 'await queryClient.invalidateQueries();',
          indent: '      ',
        }
      : {
          imports: `import { trpc } from '@/lib/trpc';`,
          client: '  const utils = trpc.useUtils();',
          list: '  const notes = trpc.notes.list.useQuery();',
          create: '  const create = trpc.notes.create.useMutation({',
          close: '  });',
          invalidate: 'await utils.notes.list.invalidate();',
          indent: '    ',
        };
  setFile(
    ctx.files,
    'app/notes/notes-client.tsx',
    `'use client';

${inline ? "import { noteInputSchema } from '@/lib/note-validation';\nimport { useState } from 'react';\n" : ''}${queries.imports}
${inline ? "import { Button } from '@/components/ui/button';\n" : ''}import { Card } from '@/components/ui/card';${inline ? "\nimport { Input } from '@/components/ui/input';" : form.importLine("'")}

export function NotesClient() {
${queries.client}${
      inline
        ? `
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');`
        : ''
    }
${queries.list}
${queries.create}
${queries.indent}onSuccess: async () => {${
      inline
        ? `
${queries.indent}  setTitle('');
${queries.indent}  setBody('');`
        : ''
    }
${queries.indent}  ${queries.invalidate}
${queries.indent}},
${queries.close}

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
            setError(parsed.error.issues[0]?.message ?? 'Invalid note');
            return;
          }
          setError(null);
          create.mutate(parsed.data);
        }}
      >
        <Input
          name="title"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Input
          name="body"
          placeholder="Body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={create.isPending}>
          Add note
        </Button>
      </form>
      {error || create.error?.message ? (
        <p role="alert" className="text-destructive text-sm">
          {error || create.error?.message}
        </p>
      ) : null}`
          : form.element(['await create.mutateAsync(input);'])
      }
      {notes.error ? (
        <p className="text-sm">
          ${transport === 'orpc' ? 'Sign in to load notes.' : 'Could not load notes.'} {String(notes.error.message ?? '')}
        </p>
      ) : null}
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
}

function emitStartTrpcNotes(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  setFile(
    ctx.files,
    'src/server/router.ts',
    `import { z } from 'zod';
${repo.importFrom("'", '../lib/')}
import { noteInputSchema } from '../lib/note-validation';
import { publicProcedure, router } from './trpc';

export const appRouter = router({
  notes: {
    list: publicProcedure.query(async () => {
      return ${repo.list}({ orderBy: { createdAt: 'desc' } });
    }),
    create: publicProcedure
      .input(noteInputSchema)
      .mutation(async ({ input }) => {
        return ${repo.create}({
          data: { title: input.title, body: input.body },
        });
      }),
    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          ...noteInputSchema.shape,
        })
      )
      .mutation(async ({ input }) => {
        return ${repo.update}({
          where: { id: input.id },
          data: { title: input.title, body: input.body },
        });
      }),
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await ${repo.remove}({ where: { id: input.id } });
        return { ok: true };
      }),
  },
});

export type AppRouter = typeof appRouter;
`
  );

  setFile(
    ctx.files,
    'src/routes/notes.tsx',
    `import { createFileRoute } from '@tanstack/react-router';
${inline ? "import { noteInputSchema } from '../lib/note-validation';\nimport { useState } from 'react';\n" : ''}import { trpc } from '../lib/trpc';${form.importLine("'", '../components/notes-form')}

export const Route = createFileRoute('/notes')({
  component: NotesPage,
});

function NotesPage() {${
      inline
        ? `
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');`
        : ''
    }
  const notes = trpc.notes.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.notes.create.useMutation({
    onSuccess: async () => {${
      inline
        ? `
      setTitle('');
      setBody('');`
        : ''
    }
      await utils.notes.list.invalidate();
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      ${
        inline
          ? `<form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = noteInputSchema.safeParse({ title, body });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Invalid note');
            return;
          }
          setError(null);
          create.mutate(parsed.data);
        }}
      >
        <label>
          Title
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label>
          Body
          <input
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button type="submit" disabled={create.isPending}>
          Add note
        </button>
      </form>
      {error || create.error?.message ? (
        <p role="alert" className="text-destructive text-sm">
          {error || create.error?.message}
        </p>
      ) : null}`
          : form.element(['await create.mutateAsync(input);'])
      }
      {notes.error ? <p>{notes.error.message}</p> : null}
      <ul>
        {(notes.data ?? []).map((note) => (
          <li key={note.id}>
            <article>
              <h2>{note.title}</h2>
              <p>{note.body}</p>
            </article>
          </li>
        ))}
      </ul>
    </main>
  );
}
`
  );
}

function emitNextServerActionNotes(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  const authed = ctx.stack.auth !== 'none';
  const sessionHelpers =
    ctx.stack.auth === 'better-auth'
      ? `import { headers } from "next/headers";
import { auth } from "@/lib/auth";
${repo.importFrom('"', '@/lib/')}

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}
`
      : ctx.stack.auth === 'clerk'
        ? `import { auth } from "@clerk/nextjs/server";
${repo.importFrom('"', '@/lib/')}

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}
`
        : `${repo.importFrom('"', '@/lib/')}
`;

  setFile(
    ctx.files,
    'app/notes/actions.ts',
    `"use server";

${sessionHelpers}
import { noteInputSchema, type NoteInput } from "@/lib/note-validation";

export async function listNotes() {
  ${authed ? 'const userId = await requireUserId();' : ''}
  return ${repo.list}({
    ${authed ? 'where: { userId },' : ''}
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(input: NoteInput) {
  ${authed ? 'const userId = await requireUserId();' : ''}
  const note = noteInputSchema.parse(input);
  return ${repo.create}({
    data: {
      title: note.title,
      body: note.body,
      ${authed ? 'userId,' : ''}
    },
  });
}
`
  );

  setFile(
    ctx.files,
    'app/notes/notes-client.tsx',
    `'use client';

import { useState } from 'react';
${inline ? "import { noteInputSchema } from '@/lib/note-validation';\nimport { Button } from '@/components/ui/button';\n" : ''}import { Card } from '@/components/ui/card';
${inline ? "import { Input } from '@/components/ui/input';\n" : ''}import { createNote, listNotes } from './actions';${form.importLine("'")}

export function NotesClient() {${
      inline
        ? `
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');`
        : ''
    }
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);${
    inline
      ? `
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);`
      : ''
  }

  return (
    <div className="flex flex-col gap-6">
      ${
        inline
          ? `<form
        className="flex flex-col gap-3"
        action={async () => {
          const parsed = noteInputSchema.safeParse({ title, body });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Invalid note');
            return;
          }
          setError(null);
          setPending(true);
          try {
            await createNote(parsed.data);
            setNotes(await listNotes());
            setTitle('');
            setBody('');
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : 'Could not save note'
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <Input
          name="title"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Input
          name="body"
          placeholder="Body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          Add note
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}`
          : form.element([
              'await createNote(input);',
              'setNotes(await listNotes());',
            ])
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
`
  );

  setFile(ctx.files, 'app/notes/page.tsx', NEXT_NOTES_PAGE);
}

function emitStartServerFnNotes(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  const form = notesForm(ctx.stack);
  const inline = form.inline;
  const authed = ctx.stack.auth !== 'none';
  const sessionHelpers =
    ctx.stack.auth === 'better-auth'
      ? `import { getRequest } from "@tanstack/react-start/server";
import { auth } from "../lib/auth";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: getRequest().headers });
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}
`
      : ctx.stack.auth === 'clerk'
        ? `import { auth } from "@clerk/tanstack-react-start/server";

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}
`
        : '';

  setFile(
    ctx.files,
    'src/server/notes.ts',
    `import { createServerFn } from "@tanstack/react-start";
${repo.importFrom('"', '../lib/')}
import { noteInputSchema } from "../lib/note-validation";
${sessionHelpers}
export const listNotes = createServerFn({ method: "GET" }).handler(async () => {
  ${authed ? 'const userId = await requireUserId();' : ''}
  return ${repo.list}({
    ${authed ? 'where: { userId },' : ''}
    orderBy: { createdAt: "desc" },
  });
});

export const createNote = createServerFn({ method: "POST" })
  .validator((input: unknown) => noteInputSchema.parse(input))
  .handler(async ({ data }) => {
    ${authed ? 'const userId = await requireUserId();' : ''}
    return ${repo.create}({
      data: { title: data.title, body: data.body${authed ? ', userId' : ''} },
    });
  });
`
  );

  setFile(
    ctx.files,
    'src/routes/notes.tsx',
    `import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
${inline ? "import { Button } from '../components/ui/button';\n" : ''}import { Card } from '../components/ui/card';
${inline ? "import { Input } from '../components/ui/input';\nimport { noteInputSchema } from '../lib/note-validation';\n" : ''}import { createNote, listNotes } from '../server/notes';${form.importLine("'", '../components/notes-form')}

export const Route = createFileRoute('/notes')({
  component: NotesPage,
});

function NotesPage() {${
      inline
        ? `
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');`
        : ''
    }
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);${
    inline
      ? `
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = noteInputSchema.safeParse({ title, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid note');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await createNote({ data: parsed.data });
      setNotes(await listNotes());
      setTitle('');
      setBody('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save note');
    } finally {
      setPending(false);
    }
  }`
      : ''
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      ${
        inline
          ? `<form className="flex flex-col gap-3" onSubmit={submitNote}>
        <Input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Input
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          Add note
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}`
          : form.element([
              'await createNote({ data: input });',
              'setNotes(await listNotes());',
            ])
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
    </main>
  );
}
`
  );
}

function emitStartOrpcNotes(ctx: EmitCtx): void {
  const repo = notesRepository(ctx.stack);
  const authenticated = ctx.stack.auth === 'better-auth';
  const withForms = ctx.stack.addons.form !== 'none';
  setFile(
    ctx.files,
    'src/server/router.ts',
    `import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
${repo.importFrom('"', '../lib/')}
import { noteInputSchema } from "../lib/note-validation";
${authenticated ? 'import { auth } from "../lib/auth";' : ''}

const procedure = os.$context<{ headers: Headers }>().errors({ NOT_FOUND: {}, UNAUTHORIZED: {} })${
      authenticated
        ? `.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: session.user } });
})`
        : ''
    };

export const router = {
  ${authenticated ? 'me: procedure.handler(({ context }) => context.user),' : ''}
  notes: {
    list: procedure.handler((${authenticated ? '{ context }' : ''}) => ${repo.list}({ ${authenticated ? 'where: { userId: context.user.id },' : ''} orderBy: { createdAt: "desc" } })),
    create: procedure.input(noteInputSchema).handler(({ input${authenticated ? ', context' : ''} }) => ${repo.create}({ data: { title: input.title, body: input.body${authenticated ? ', userId: context.user.id' : ''} } })),
    update: procedure.input(noteInputSchema.extend({ id: z.string().min(1) })).handler(async ({ input${authenticated ? ', context' : ''} }) => {
      const result = await ${repo.updateMany}({ where: { id: input.id${authenticated ? ', userId: context.user.id' : ''} }, data: { title: input.title, body: input.body } });
      if (!result.count) throw new ORPCError("NOT_FOUND");
      return { ok: true };
    }),
    delete: procedure.input(z.object({ id: z.string().min(1) })).handler(async ({ input${authenticated ? ', context' : ''} }) => {
      const result = await ${repo.deleteMany}({ where: { id: input.id${authenticated ? ', userId: context.user.id' : ''} } });
      if (!result.count) throw new ORPCError("NOT_FOUND");
      return { ok: true };
    }),
  },
};
`
  );
  setFile(
    ctx.files,
    'src/routes/notes.tsx',
    `import { ${authenticated ? 'useEffect, ' : ''}useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute${authenticated ? ', redirect' : ''} } from "@tanstack/react-router";
import { orpc${authenticated ? ', client' : ''} } from "../lib/orpc";
${withForms ? 'import type { NoteInput } from "../lib/note-validation";\nimport { NotesForm } from "../components/notes-form";' : 'import { noteInputSchema } from "../lib/note-validation";'}
import { Button } from "../components/ui/button";
${withForms ? '' : 'import { Input } from "../components/ui/input";'}
import { Card } from "../components/ui/card";
${
  authenticated
    ? `import { authClient } from "../lib/auth-client";
import { resetSession } from "../lib/reset-session";`
    : ''
}

export const Route = createFileRoute("/notes")({
  ${
    authenticated
      ? `beforeLoad: async () => {
    try { return { user: await client.me() }; }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "UNAUTHORIZED") throw redirect({ to: "/login" });
      throw error;
    }
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),`
      : ''
  }
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.notes.list.queryOptions()),
  pendingComponent: () => <p role="status">Loading notes...</p>,
  errorComponent: ({ error, reset }) => <main className="p-8"><p role="alert">{error instanceof Error ? error.message : "Could not load notes"}</p><Button onClick={reset}>Try again</Button></main>,
  component: NotesPage,
});

function NotesPage() {
  const queryClient = useQueryClient();
  const notes = useSuspenseQuery(orpc.notes.list.queryOptions());
  ${withForms ? '' : 'const [title, setTitle] = useState("");\n  const [body, setBody] = useState("");'}
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refreshNotes = () => queryClient.invalidateQueries({ queryKey: orpc.notes.list.key() });
  const create = useMutation(orpc.notes.create.mutationOptions());
  const update = useMutation(orpc.notes.update.mutationOptions());
  const remove = useMutation(orpc.notes.delete.mutationOptions({ onSuccess: refreshNotes }));
  const pending = create.isPending || update.isPending || remove.isPending;
  ${
    authenticated
      ? `const { user } = Route.useRouteContext();
  const session = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const identityChanged = !session.isPending && session.data?.user.id !== user.id;
  useEffect(() => {
    if (identityChanged) void resetSession(queryClient, session.data?.user ? "/notes" : "/login");
  }, [identityChanged, queryClient, session.data?.user]);

  async function signOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message ?? "Could not sign out");
      await resetSession(queryClient, "/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out");
      setSigningOut(false);
    }
  }`
      : ''
  }

  ${
    withForms
      ? `const editingNote = notes.data.find((note) => note.id === editingId);
  async function saveNote(input: NoteInput) {
    if (editingId) await update.mutateAsync({ id: editingId, ...input });
    else await create.mutateAsync(input);
    await refreshNotes();
    setEditingId(null);
  }`
      : `async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = noteInputSchema.safeParse({ title, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setError(null);
    try {
      if (editingId) await update.mutateAsync({ id: editingId, ...parsed.data });
      else await create.mutateAsync(parsed.data);
      setTitle("");
      setBody("");
      setEditingId(null);
      await refreshNotes();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save note");
    }
  }`
  }

  ${authenticated ? 'if (identityChanged || signingOut) return <p role="status">Updating session...</p>;' : ''}
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
    <h1 className="text-2xl font-semibold">Notes</h1>
    ${authenticated ? '<div className="flex items-center justify-between"><p>Signed in as {user.email}</p><Button type="button" onClick={() => { void signOut(); }}>Sign out</Button></div>' : ''}
    ${
      withForms
        ? `<NotesForm
      key={editingId ?? "new"}
      defaultValues={{ title: editingNote?.title ?? "", body: editingNote?.body ?? "" }}
      submitLabel={editingId ? "Save changes" : "Add note"}
      onSubmit={saveNote}
    />
    {editingId ? <Button type="button" disabled={pending} onClick={() => setEditingId(null)}>Cancel editing</Button> : null}`
        : `<form className="flex flex-col gap-3" onSubmit={submitNote}>
      <label htmlFor="note-title">Title</label>
      <Input id="note-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required disabled={pending} />
      <label htmlFor="note-body">Body</label>
      <Input id="note-body" name="body" value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} />
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : editingId ? "Save changes" : "Add note"}</Button>
      {editingId ? <Button type="button" disabled={pending} onClick={() => { setEditingId(null); setTitle(""); setBody(""); setError(null); }}>Cancel editing</Button> : null}
    </form>`
    }
    {error || remove.error ? <p role="alert">{error ?? remove.error?.message}</p> : null}
    {notes.data.length === 0 ? <p>No notes yet.</p> : null}
    <ul className="flex flex-col gap-3">{notes.data.map((note) => <li key={note.id}>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">{note.title}</h2>
        <p>{note.body}</p>
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => { setEditingId(note.id); ${withForms ? '' : 'setTitle(note.title); setBody(note.body);'} setError(null); }}>Edit</Button>
          <Button type="button" disabled={pending} onClick={() => remove.mutate({ id: note.id })}>Delete</Button>
        </div>
      </Card>
    </li>)}</ul>
  </main>;
}
`
  );
}
