import type { EmitCtx } from '../../types/generate';
import {
  notesFormSource,
  rhfFormAssets,
  tanstackFormAssets,
} from '../assets/forms/source';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { fillTemplate } from '../template-tokens';

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

  const tokens =
    ctx.layout.structure === 'single'
      ? {
          UI_PREFIX: '@/components/ui/',
          NOTE_VALIDATION: '@/lib/note-validation',
        }
      : { UI_PREFIX: '@repo/ui/', NOTE_VALIDATION: '@repo/validation' };
  const adapt = (source: string) => fillTemplate(source, tokens);
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
}
