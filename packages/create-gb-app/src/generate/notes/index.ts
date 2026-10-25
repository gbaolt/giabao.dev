import type { EmitCtx } from '../../types/generate';
import { setFile } from '../files';
import { emitConvexNotes } from './convex';
import { emitHonoNotes } from './hono';
import { emitNestNotes } from './nest';
import { emitNotesStore } from './repository';
import { emitSelfNotes } from './self';

// Writes every Notes file for the Stack in its final form; nothing patches
// Notes code afterwards.
export function emitNotes(ctx: EmitCtx): void {
  emitNotesStore(ctx);
  switch (ctx.stack.backend) {
    case 'self':
      emitSelfNotes(ctx);
      break;
    case 'convex':
      emitConvexNotes(ctx);
      break;
    case 'nest':
      emitNestNotes(ctx);
      break;
    case 'hono':
      emitHonoNotes(ctx);
      break;
    default: {
      const _exhaustive: never = ctx.stack;
      throw new Error(`unhandled backend: ${JSON.stringify(_exhaustive)}`);
    }
  }
  emitFormDemo(ctx);
}

// Without a database the form library still gets a page that validates input.
function emitFormDemo(ctx: EmitCtx): void {
  if (
    ctx.stack.backend === 'convex' ||
    ctx.stack.database !== 'none' ||
    ctx.stack.addons.form === 'none'
  )
    return;
  const isNext = ctx.stack.frontend === 'next';
  const webRoot = ctx.layout.frontendRoot ? ctx.layout.frontendRoot + '/' : '';
  const demo = `import { NotesForm } from "@/components/notes-form";
${!isNext ? 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/notes")({ component: NotesPage });' : ''}
${isNext ? 'export default' : ''} function NotesPage() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8"><h1 className="text-2xl font-semibold">Notes</h1><NotesForm persistent={false} onSubmit={async () => {}} /></main>;
}
`;
  setFile(
    ctx.files,
    webRoot + (isNext ? 'app/notes/page.tsx' : 'src/routes/notes.tsx'),
    isNext ? '"use client";\n' + demo : demo
  );
}
