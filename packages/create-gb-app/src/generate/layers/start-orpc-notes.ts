import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';

export function emitStartOrpcNotes(ctx: EmitCtx): void {
  setFile(
    ctx.files,
    'src/server/router.ts',
    `import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { prisma } from "../lib/db";
import { noteInputSchema } from "../lib/note-validation";

const procedure = os.$context<{ headers: Headers }>().errors({ NOT_FOUND: {} });

export const router = {
  notes: {
    list: procedure.handler(() => prisma.note.findMany({ orderBy: { createdAt: "desc" } })),
    create: procedure.input(noteInputSchema).handler(({ input }) => prisma.note.create({ data: input })),
    update: procedure.input(noteInputSchema.extend({ id: z.string().min(1) })).handler(async ({ input }) => {
      const result = await prisma.note.updateMany({ where: { id: input.id }, data: { title: input.title, body: input.body } });
      if (!result.count) throw new ORPCError("NOT_FOUND");
      return { ok: true };
    }),
    delete: procedure.input(z.object({ id: z.string().min(1) })).handler(async ({ input }) => {
      const result = await prisma.note.deleteMany({ where: { id: input.id } });
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
    `import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { orpc } from "../lib/orpc";
import { noteInputSchema } from "../lib/note-validation";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";

export const Route = createFileRoute("/notes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.notes.list.queryOptions()),
  pendingComponent: () => <p role="status">Loading notes...</p>,
  errorComponent: ({ error, reset }) => <main className="p-8"><p role="alert">{error instanceof Error ? error.message : "Could not load notes"}</p><Button onClick={reset}>Try again</Button></main>,
  component: NotesPage,
});

function NotesPage() {
  const queryClient = useQueryClient();
  const notes = useSuspenseQuery(orpc.notes.list.queryOptions());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refreshNotes = () => queryClient.invalidateQueries({ queryKey: orpc.notes.list.key() });
  const create = useMutation(orpc.notes.create.mutationOptions());
  const update = useMutation(orpc.notes.update.mutationOptions());
  const remove = useMutation(orpc.notes.delete.mutationOptions({ onSuccess: refreshNotes }));
  const pending = create.isPending || update.isPending || remove.isPending;

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
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
  }

  return <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
    <h1 className="text-2xl font-semibold">Notes</h1>
    <form className="flex flex-col gap-3" onSubmit={submitNote}>
      <label htmlFor="note-title">Title</label>
      <Input id="note-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required disabled={pending} />
      <label htmlFor="note-body">Body</label>
      <Input id="note-body" name="body" value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} />
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : editingId ? "Save changes" : "Add note"}</Button>
      {editingId ? <Button type="button" disabled={pending} onClick={() => { setEditingId(null); setTitle(""); setBody(""); setError(null); }}>Cancel editing</Button> : null}
    </form>
    {error || remove.error ? <p role="alert">{error ?? remove.error?.message}</p> : null}
    {notes.data.length === 0 ? <p>No notes yet.</p> : null}
    <ul className="flex flex-col gap-3">{notes.data.map((note) => <li key={note.id}>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">{note.title}</h2>
        <p>{note.body}</p>
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => { setEditingId(note.id); setTitle(note.title); setBody(note.body); setError(null); }}>Edit</Button>
          <Button type="button" disabled={pending} onClick={() => remove.mutate({ id: note.id })}>Delete</Button>
        </div>
      </Card>
    </li>)}</ul>
  </main>;
}
`
  );
}
