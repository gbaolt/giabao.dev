import type { EmitCtx } from '../../types/generate';
import {
  notesFormSource,
  rhfFormAssets,
  tanstackFormAssets,
} from '../assets/forms/source';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitForms(ctx: EmitCtx): void {
  if (ctx.stack.addons.form === 'none') return;
  const isNext = ctx.stack.frontend === 'next';
  const webRoot = ctx.layout.frontendRoot ? ctx.layout.frontendRoot + '/' : '';
  const sourceRoot = webRoot + (isNext ? '' : 'src/');
  const assets =
    ctx.stack.addons.form === 'react-hook-form'
      ? rhfFormAssets
      : tanstackFormAssets;
  const deps =
    ctx.stack.addons.form === 'react-hook-form'
      ? ['react-hook-form', '@hookform/resolvers']
      : ['@tanstack/react-form'];
  const manifest =
    ctx.layout.structure === 'single'
      ? ctx.pkg
      : JSON.parse(ctx.files[ctx.layout.frontendManifest]!);
  for (const dependency of deps)
    manifest.dependencies[dependency] =
      DEPENDENCY_VERSIONS[dependency as keyof typeof DEPENDENCY_VERSIONS];
  if (ctx.layout.structure === 'monorepo')
    setFile(
      ctx.files,
      ctx.layout.frontendManifest,
      JSON.stringify(manifest, null, 2)
    );

  const adapt = (source: string) =>
    ctx.layout.structure === 'single'
      ? source
      : source
          .replaceAll('@/components/ui/', '@repo/ui/')
          .replaceAll('@/lib/note-validation', '@repo/validation');
  for (const [name, source] of Object.entries(assets))
    setFile(ctx.files, sourceRoot + 'components/form/' + name, adapt(source));
  setFile(
    ctx.files,
    sourceRoot + 'components/notes-form.tsx',
    adapt(notesFormSource(ctx.stack.addons.form))
  );
  setFile(
    ctx.files,
    sourceRoot + 'components/form/README.md',
    `# Form controls

These controls adapt the supplied ${ctx.stack.addons.form === 'react-hook-form' ? 'React Hook Form controller pattern' : 'TanStack form-hook composition'} to shadcn Base UI. Input and textarea controls represent strings; numeric, file, OTP, date, and combobox variants are outside this starter's form API. Parse optional numeric strings explicitly in your schema so an empty field is never silently converted to zero.

The Notes form submits the shared schema's parsed values, disables controls while submitting, retains entered values after a failure, and resets after a successful submission. Every field instance has a React-generated ID linking its label, help, and error messages. Select options carry their values; checkbox callbacks carry booleans.
`
  );

  const clientPath = isNext
    ? webRoot + 'app/notes/notes-client.tsx'
    : sourceRoot + 'routes/notes.tsx';
  const client = ctx.files[clientPath];
  if (client?.includes('<form')) {
    setFile(ctx.files, clientPath, integrateNotesForm(client));
  } else if (ctx.stack.backend !== 'convex' && ctx.stack.database === 'none') {
    const demo = `import { NotesForm } from "@/components/notes-form";
${!isNext ? 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/notes")({ component: NotesPage });' : ''}
${isNext ? 'export default' : ''} function NotesPage() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8"><h1 className="text-2xl font-semibold">Notes</h1><NotesForm persistent={false} onSubmit={async () => {}} /></main>;
}
`;
    setFile(
      ctx.files,
      isNext ? webRoot + 'app/notes/page.tsx' : clientPath,
      isNext ? '"use client";\n' + demo : demo
    );
  }
}

function integrateNotesForm(source: string): string {
  const form = source.match(/<form\b[\s\S]*?<\/form>/)?.[0];
  if (!form) throw new Error('Missing generated Notes form');
  let submission: string;
  if (source.includes('client.notes.create.mutate(')) {
    submission = 'await client.notes.create.mutate(input);';
    if (source.includes('setNotes(await client.notes.list.query())'))
      submission += '\nsetNotes(await client.notes.list.query());';
  } else if (source.includes('create.mutate(')) {
    submission = 'await create.mutateAsync(input);';
  } else if (source.includes('await createNote(')) {
    submission = source.includes('await createNote({ data:')
      ? 'await createNote({ data: input });'
      : 'await createNote(input);';
    if (source.includes('setNotes(await listNotes())'))
      submission += '\nsetNotes(await listNotes());';
  } else if (source.includes('await create(parsed.data)')) {
    submission = 'await create(input);';
  } else {
    const body = form.match(/try \{\s*([\s\S]*?)\s*\} catch \(cause\)/)?.[1];
    if (!body) throw new Error('Unsupported generated Notes submission');
    submission = body
      .replaceAll('parsed.data', 'input')
      .replace(/\s*set(?:Title|Body)\(""\);/g, '');
  }
  let result = source
    .replace(
      form,
      `<NotesForm onSubmit={async (input) => { ${submission} }} />`
    )
    .replace(/  async function submitNote[\s\S]*?\n  }\n/, '')
    .replace(
      /\s*const \[(?:title, setTitle|body, setBody|error, setError|pending, setPending)\] = useState[^;]*;/g,
      ''
    )
    .replace(/\s*set(?:Title|Body)\(""\);/g, '')
    .replace(/\s*\{error[^\n]*<\/p> : null\}/g, '')
    .replace(/^import \{ noteInputSchema \} from [^\n]*\n/gm, '')
    .replace(/^import \{ (?:Button|Input) \} from [^\n]*\n/gm, '');
  if (!result.includes('useState(') && !result.includes('useState<'))
    result = result.replace(/^import \{ useState \} from "react";\n/gm, '');
  const boundary = result.startsWith('"use client";') ? '"use client";\n' : '';
  result = result.slice(boundary.length);
  return (
    boundary + 'import { NotesForm } from "@/components/notes-form";\n' + result
  );
}
