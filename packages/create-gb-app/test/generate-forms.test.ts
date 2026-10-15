import { expect, test } from 'bun:test';
import ts from 'typescript';

import { buildTree, resolveStack } from '#/generate/public';
import { decodePreset, encodePreset, YES_DEFAULTS } from '#/preset';
for (const frontend of ['next', 'tanstack-start'] as const) {
  for (const form of ['react-hook-form', 'tanstack-form'] as const) {
    test(`${frontend} Hono tRPC ${form} submits through its generated client`, async () => {
      const files = buildTree(
        resolveStack({
          backend: 'hono',
          frontend,
          api: 'trpc',
          auth: 'none',
          form,
        }),
        { projectName: 'forms', packageManager: 'bun' }
      );
      const path =
        frontend === 'next'
          ? 'apps/web/app/notes/notes-client.tsx'
          : 'apps/web/src/routes/notes.tsx';
      const source = ts.createSourceFile(
        path,
        files[path]!,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      let submission: string | undefined;
      const visit = (node: ts.Node): void => {
        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === 'onSubmit' &&
          node.initializer &&
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression
        ) {
          submission = node.initializer.expression.getText(source);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(submission).toBeDefined();
      const compilationPath = '/generated-submission.ts';
      const options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      };
      const host = ts.createCompilerHost(options);
      const readSource = host.getSourceFile;
      host.getSourceFile = (name, ...args) =>
        name === compilationPath
          ? ts.createSourceFile(
              name,
              `
          type NoteInput = { title: string; body: string };
          declare const client: { notes: {
            create: { mutate(input: NoteInput): Promise<void> };
            list: { query(): Promise<NoteInput[]> };
          } };
          declare function setNotes(notes: NoteInput[]): void;
          const submit: (input: NoteInput) => Promise<void> = ${submission};
        `,
              ts.ScriptTarget.ES2022,
              true
            )
          : readSource(name, ...args);
      const program = ts.createProgram([compilationPath], options, host);
      expect(
        ts
          .getPreEmitDiagnostics(program)
          .map((diagnostic) =>
            ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
          )
      ).toEqual([]);
      const input = { title: 'A note', body: 'Its body' };
      const saved: (typeof input)[] = [];
      let refreshed: unknown;
      let fail = false;
      const client = {
        notes: {
          create: {
            mutate: async (value: typeof input) => {
              if (fail) throw new Error('Server failed');
              saved.push(value);
            },
          },
          list: { query: async () => saved },
        },
      };
      const callback = new Function(
        'client',
        'setNotes',
        `return (${submission});`
      )(client, (notes: unknown) => {
        refreshed = notes;
      }) as (value: typeof input) => Promise<void>;
      await callback(input);
      expect(saved).toEqual([input]);
      if (frontend === 'next') expect(refreshed).toEqual([input]);
      fail = true;
      await expect(callback(input)).rejects.toThrow('Server failed');
      expect(saved).toHaveLength(1);
    });
  }
}
test('forms default to none and preserve existing saved commands', () => {
  expect(resolveStack({ yes: true }).addons.form).toBe('none');
  expect(decodePreset('gb0').addons.form).toBe('none');
  expect(
    decodePreset(
      encodePreset({
        ...YES_DEFAULTS,
        addons: {
          ...YES_DEFAULTS.addons,
          form: 'react-hook-form',
        },
      })
    ).addons.form
  ).toBe('react-hook-form');
});
test('React Hook Form selection includes only its reusable integration', () => {
  const files = buildTree(
    resolveStack({
      auth: 'none',
      api: 'none',
      database: 'none',
      addons: {
        form: 'react-hook-form',
      },
    }),
    { projectName: 'forms', packageManager: 'bun' }
  );
  const pkg = JSON.parse(files['package.json']!);
  expect(pkg.dependencies['react-hook-form']).toBeDefined();
  expect(pkg.dependencies['@hookform/resolvers']).toBeDefined();
  expect(pkg.dependencies['@tanstack/react-form']).toBeUndefined();
  expect(files['components/form/form-base.tsx']).toContain('Controller');
  expect(files['components/form/form-input.tsx']).toBeDefined();
  expect(files['components/form/form-select.tsx']).toBeDefined();
  expect(files['app/notes/page.tsx']).toBeDefined();
  expect(files['components/notes-form.tsx']).toContain('zodResolver');
});
for (const frontend of ['next', 'tanstack-start'] as const) {
  for (const structure of ['single', 'turborepo'] as const) {
    for (const form of ['none', 'react-hook-form', 'tanstack-form'] as const) {
      test(frontend + ' ' + structure + ' emits exclusively ' + form, () => {
        const files = buildTree(
          resolveStack({
            frontend,
            structure,
            auth: 'none',
            api: 'none',
            database: 'none',
            form,
          }),
          { projectName: 'forms', packageManager: 'bun' }
        );
        const root = structure === 'turborepo' ? 'apps/web/' : '';
        const source = root + (frontend === 'next' ? '' : 'src/');
        const pkg = JSON.parse(files[root + 'package.json']!);
        expect(Boolean(pkg.dependencies['react-hook-form'])).toBe(
          form === 'react-hook-form'
        );
        expect(Boolean(pkg.dependencies['@hookform/resolvers'])).toBe(
          form === 'react-hook-form'
        );
        expect(Boolean(pkg.dependencies['@tanstack/react-form'])).toBe(
          form === 'tanstack-form'
        );
        expect(Boolean(files[source + 'components/notes-form.tsx'])).toBe(
          form !== 'none'
        );
        if (form !== 'none') {
          for (const control of [
            'base',
            'input',
            'textarea',
            'select',
            'checkbox',
          ]) {
            expect(
              files[source + 'components/form/form-' + control + '.tsx']
            ).toBeDefined();
          }
          const page =
            frontend === 'next'
              ? root + 'app/notes/page.tsx'
              : source + 'routes/notes.tsx';
          expect(files[page]).toContain('persistent={false}');
        }
      });
    }
  }
}
