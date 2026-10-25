# Generator templates

Edit generated source here as ordinary code, then serialize it into the committed
JSON assets used by the CLI and Create.

From `packages/create-gb-app`:

```sh
bun run format
bun run templates:generate
bun run templates:check
bun run test
```

Review and commit both the template changes and generated JSON. The serializer
preserves source text, normalizes CRLF to LF, sorts keys, and escapes the text
with `JSON.stringify`. It does not execute or format templates. Repeat generation
leaves unchanged assets untouched. `templates:check` reports stale assets without
writing files; tests, format checking and CLI builds run that check.

## What belongs here

A file belongs in `templates/` only when its content is fully static apart from
tokens. Files with conditional content stay inline in their generator layer.

## Asset mapping

The `FAMILIES` list in `script/templates.ts` declares each family, its asset
path, allowed extensions and directories. Add a family or directory there.

- `shadcn/` preserves file paths as keys in
  `src/generate/assets/shadcn/formatted-source.json`.
- `forms/rhf/` and `forms/tanstack/` preserve filenames in the matching groups of
  `src/generate/assets/forms/formatted-source.json`. Files under `forms/notes/`
  use the form library name without `.tsx` as their key.
- `login/forms/` and `login/pages/` use filenames without `.tsx` in the matching
  groups of `src/generate/assets/login/source.json`.
- `next/` preserves file paths in `src/generate/assets/next/source.json`, except
  `next-env.template.d.ts` becomes `next-env.d.ts`. Its authored name avoids the
  repository's ignore rule for Next's generated declaration file.
- `styles/` preserves filenames in `src/generate/assets/styles/source.json`.
  Next and TanStack Start share its global stylesheet.

Unexpected files, directories and symlinks fail generation.

## Tokens

Tokens use the `__NAME__` syntax, such as `__UI_PREFIX__`, `__NOTE_VALIDATION__`
and `__PROJECT_NAME__`. Layers fill them with `fillTemplate` from
`src/generate/template-tokens.ts`, which throws on a token without a value and
on any token left after substitution.

## Verification boundaries

Templates belong to generated applications with their own dependencies and JSX
configuration. They are outside the CLI's TypeScript project and typed ESLint
rules. Prettier checks their syntax and formatting. The generator's output tests
and application verification cover how they combine into applications.

Formatting these templates does not guarantee that every file remains formatted
after later layer transformations.

The shadcn `reference/shadcn/source.json` is the untouched upstream reference,
not generated output. It stays outside `src` so the published package omits it.
Preserve it when editing local templates.
