import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { emitStartOrpcNotes } from './start-orpc-notes';

export function emitNotes(ctx: EmitCtx): void {
  if (
    ctx.stack.backend === 'self' &&
    ctx.stack.frontend === 'tanstack-start' &&
    ctx.stack.api === 'orpc'
  ) {
    emitStartOrpcNotes(ctx);
    return;
  }
  if (ctx.stack.backend === 'convex') {
    emitConvexNotes(ctx);
    return;
  }
  if (ctx.stack.database === 'none') {
    return;
  }
  if (ctx.stack.api === 'none') {
    if (ctx.stack.frontend === 'tanstack-start') {
      emitStartServerFnNotes(ctx);
      return;
    }
    emitNextServerActionNotes(ctx);
    return;
  }
  if (
    ctx.stack.frontend === 'tanstack-start' &&
    ctx.stack.backend === 'self' &&
    ctx.stack.api === 'trpc'
  ) {
    emitStartTrpcNotes(ctx);
    return;
  }

  setFile(
    ctx.files,
    'router.ts',
    `import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
      return prisma.note.findMany({
        where: { userId: context.user.id },
        orderBy: { createdAt: 'desc' },
      });
    }),
    create: authed
      .input(noteInputSchema)
      .handler(async ({ input, context }) => {
        return prisma.note.create({
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
        const note = await prisma.note.findFirst({
          where: { id: input.id, userId: context.user.id },
        });
        if (!note) {
          throw new ORPCError('NOT_FOUND');
        }
        return prisma.note.update({
          where: { id: note.id },
          data: { title: input.title, body: input.body },
        });
      }),
    delete: authed
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        const note = await prisma.note.findFirst({
          where: { id: input.id, userId: context.user.id },
        });
        if (!note) {
          throw new ORPCError('NOT_FOUND');
        }
        await prisma.note.delete({ where: { id: note.id } });
        return { ok: true };
      }),
  },
};
`
  );

  setFile(
    ctx.files,
    'app/notes/page.tsx',
    `import Link from 'next/link';
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
`
  );

  setFile(
    ctx.files,
    'app/notes/notes-client.tsx',
    `'use client';

import { noteInputSchema } from '@/lib/note-validation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function NotesClient() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const notes = useQuery(orpc.notes.list.queryOptions());
  const create = useMutation(
    orpc.notes.create.mutationOptions({
      onSuccess: async () => {
        setTitle('');
        setBody('');
        await queryClient.invalidateQueries();
      },
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <form
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
      ) : null}
      {notes.error ? (
        <p className="text-sm">
          Sign in to load notes. {String(notes.error.message ?? '')}
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
  setFile(
    ctx.files,
    'src/server/router.ts',
    `import { z } from 'zod';
import { prisma } from '../lib/db';
import { noteInputSchema } from '../lib/note-validation';
import { publicProcedure, router } from './trpc';

export const appRouter = router({
  notes: {
    list: publicProcedure.query(async () => {
      return prisma.note.findMany({ orderBy: { createdAt: 'desc' } });
    }),
    create: publicProcedure
      .input(noteInputSchema)
      .mutation(async ({ input }) => {
        return prisma.note.create({
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
        return prisma.note.update({
          where: { id: input.id },
          data: { title: input.title, body: input.body },
        });
      }),
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await prisma.note.delete({ where: { id: input.id } });
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
import { noteInputSchema } from '../lib/note-validation';
import { useState } from 'react';
import { trpc } from '../lib/trpc';

export const Route = createFileRoute('/notes')({
  component: NotesPage,
});

function NotesPage() {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const notes = trpc.notes.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.notes.create.useMutation({
    onSuccess: async () => {
      setTitle('');
      setBody('');
      await utils.notes.list.invalidate();
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <form
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
      ) : null}
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
  const authed = ctx.stack.auth !== 'none';
  const sessionHelpers =
    ctx.stack.auth === 'better-auth'
      ? `import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
import { prisma } from "@/lib/db";

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}
`
        : `import { prisma } from "@/lib/db";
`;

  setFile(
    ctx.files,
    'app/notes/actions.ts',
    `"use server";

${sessionHelpers}
import { noteInputSchema, type NoteInput } from "@/lib/note-validation";

export async function listNotes() {
  ${authed ? 'const userId = await requireUserId();' : ''}
  return prisma.note.findMany({
    ${authed ? 'where: { userId },' : ''}
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(input: NoteInput) {
  ${authed ? 'const userId = await requireUserId();' : ''}
  const note = noteInputSchema.parse(input);
  return prisma.note.create({
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
import { noteInputSchema } from '@/lib/note-validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createNote, listNotes } from './actions';

export function NotesClient() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <form
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
      ) : null}
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

  setFile(
    ctx.files,
    'app/notes/page.tsx',
    `import Link from 'next/link';
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
`
  );
}

function emitStartServerFnNotes(ctx: EmitCtx): void {
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
import { prisma } from "../lib/db";
import { noteInputSchema } from "../lib/note-validation";
${sessionHelpers}
export const listNotes = createServerFn({ method: "GET" }).handler(async () => {
  ${authed ? 'const userId = await requireUserId();' : ''}
  return prisma.note.findMany({
    ${authed ? 'where: { userId },' : ''}
    orderBy: { createdAt: "desc" },
  });
});

export const createNote = createServerFn({ method: "POST" })
  .validator((input: unknown) => noteInputSchema.parse(input))
  .handler(async ({ data }) => {
    ${authed ? 'const userId = await requireUserId();' : ''}
    return prisma.note.create({
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
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { noteInputSchema } from '../lib/note-validation';
import { createNote, listNotes } from '../server/notes';

export const Route = createFileRoute('/notes')({
  component: NotesPage,
});

function NotesPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);
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
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <form className="flex flex-col gap-3" onSubmit={submitNote}>
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
      ) : null}
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

function emitConvexNotes(ctx: EmitCtx): void {
  const isNext = ctx.stack.frontend === 'next';
  if (isNext)
    setFile(
      ctx.files,
      'app/notes/page.tsx',
      `import { NotesClient } from "./notes-client";\n\nexport default function NotesPage() { return <NotesClient />; }\n`
    );
  setFile(
    ctx.files,
    isNext ? 'app/notes/notes-client.tsx' : 'src/routes/notes.tsx',
    `${isNext ? '"use client";\n' : 'import { createFileRoute } from "@tanstack/react-router";'}
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../${isNext ? '' : '../'}convex/_generated/api";
import { noteInputSchema } from "@/lib/note-validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

${
  isNext
    ? ''
    : `export const Route = createFileRoute("/notes")({
  component: NotesPage,
});`
}

${isNext ? 'export function NotesClient' : 'function NotesPage'}() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const notes = useQuery(api.notes.list);
  const create = useMutation(api.notes.create);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <form
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
            await create(parsed.data);
            setTitle("");
            setBody("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save note");
          } finally {
            setPending(false);
          }
        }}
      >
        <Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Input name="body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit" disabled={pending}>Add note</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ul>
        {(notes ?? []).map((note) => (
          <li key={note._id}>
            <Card className="p-4"><h2 className="font-medium">{note.title}</h2><p>{note.body}</p></Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
`
  );
}
