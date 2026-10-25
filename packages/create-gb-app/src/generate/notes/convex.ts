import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { notesForm } from './form';

export function emitConvexNotes(ctx: EmitCtx): void {
  if (ctx.stack.backend !== 'convex') return;
  const isNext = ctx.stack.frontend === 'next';
  const authed = ctx.stack.auth === 'clerk';
  const form = notesForm(ctx.stack);
  const inline = form.inline;

  setFile(
    ctx.files,
    'convex/notes.ts',
    `import { v } from "convex/values";
import { noteInputSchema } from "../${isNext ? '' : 'src/'}lib/note-validation";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    ${
      authed
        ? `const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }`
        : ''
    }
    return ctx.db
      .query("notes")
      ${authed ? '.withIndex("by_user", (q) => q.eq("userId", identity.subject))' : ''}
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    ${
      authed
        ? `const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }`
        : ''
    }
    const note = noteInputSchema.parse(args);
    return ctx.db.insert("notes", {
      title: note.title,
      body: note.body,
      ${authed ? 'userId: identity.subject,' : ''}
    });
  },
});
`
  );

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
${inline ? 'import { useState } from "react";\n' : ''}import { api } from "../../${isNext ? '' : '../'}convex/_generated/api";
${inline ? 'import { noteInputSchema } from "@/lib/note-validation";\nimport { Button } from "@/components/ui/button";\n' : ''}import { Card } from "@/components/ui/card";${inline ? '\nimport { Input } from "@/components/ui/input";' : form.importLine('"')}

${
  isNext
    ? ''
    : `export const Route = createFileRoute("/notes")({
  component: NotesPage,
});`
}

${isNext ? 'export function NotesClient' : 'function NotesPage'}() {${
      inline
        ? `
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");`
        : ''
    }
  const notes = useQuery(api.notes.list);
  const create = useMutation(api.notes.create);${
    inline
      ? `
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);`
      : ''
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Notes</h1>
      ${
        inline
          ? `<form
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
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}`
          : form.element(['await create(input);'])
      }
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
