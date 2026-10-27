import type { Stack } from '../../types/stack';

// A Notes page either renders its own inline form or delegates to the shared
// NotesForm, which owns validation, pending state, error display, and reset.
export type NotesFormAdapter = {
  inline: boolean;
  // Newline-prefixed so it can follow the last import line directly.
  importLine(quote: '"' | "'", path?: string): string;
  // Pages place the form at six spaces of JSX indentation.
  element(statements: string[]): string;
};

export function notesForm(stack: Stack): NotesFormAdapter {
  const inline = stack.addons.form === 'none';
  return {
    inline,
    importLine: (quote, path = '@/components/notes-form') =>
      inline ? '' : `\nimport { NotesForm } from ${quote}${path}${quote};`,
    element: (statements) => `<NotesForm
        onSubmit={async (input) => {
          ${statements.join('\n          ')}
        }}
      />`,
  };
}

// Form-library submissions for pages that post to a REST endpoint.
export function restCreate(path: string, refresh: boolean): string[] {
  return [
    `const response = await fetch(serverUrl + "${path}", {`,
    '  method: "POST",',
    '  credentials: "include",',
    '  headers: { "content-type": "application/json" },',
    '  body: JSON.stringify(input),',
    '});',
    'if (!response.ok) {',
    '  const failure = await response.json().catch(() => null);',
    '  throw new Error(failure?.issues?.[0]?.message ?? failure?.error ?? "Could not save note");',
    '}',
    ...(refresh
      ? [
          `const listResponse = await fetch(serverUrl + "${path}", { credentials: "include" });`,
          'setNotes(await listResponse.json());',
        ]
      : []),
  ];
}
