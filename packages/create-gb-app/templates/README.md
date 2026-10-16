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

## Asset mapping

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

Keep `__UI_PREFIX__` and `__PROJECT_NAME__` tokens intact. Existing generator
layers perform their context-specific substitutions. Add templates within the
existing directory groups; unexpected files, directories and symlinks fail generation.
New families or naming conventions require an explicit serializer change.

## Verification boundaries

Templates belong to generated applications with their own dependencies and JSX
configuration. They are outside the CLI's TypeScript project and typed ESLint
rules. Prettier checks their syntax and formatting. The generator's output tests
and application verification cover how they combine into applications.

The current migration includes shadcn, form and login assets plus static Next
snippets. Dynamic layers still contain strings. Formatting these templates does
not guarantee that every file remains formatted after later layer transformations.

The shadcn `src/generate/assets/shadcn/source.json` is the untouched upstream
reference, not generated output. Preserve it when editing local templates.
