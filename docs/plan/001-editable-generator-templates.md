# Plan 001: Author generator assets as editable source files

> **Executor instructions:** Read the whole plan before editing. Run each step's
> verification before proceeding. Stop on the conditions below. Update the status
> in `docs/plan/README.md` when complete, unless a reviewer owns that index.
>
> **Drift check:** Run `git diff --stat c30645a..HEAD -- packages/create-gb-app apps/web/features/create` and `git status --short`.
> Compare changed files with the excerpts below. Stop if their behavior or asset
> shapes changed. Preserve unrelated working changes.

## Status

- Implementation: DONE on 2026-10-16, with the pre-existing package-wide formatting exception recorded in `docs/plan/README.md`.
- Priority: P1
- Effort: M, approximately one to two days including verification
- Risk: MED, because downstream transformations inspect generated source text
- Depends on: none
- Category: dx
- Planned at: commit `c30645a`, 2026-10-16

## Why this matters

Generated programs are currently authored inside TypeScript strings or JSON
strings. Formatting the containing file does not format the embedded program.
Authors should edit normal source files with syntax highlighting and formatting,
then run a small development script to serialize those files into JSON assets.
The CLI and Create must continue consuming the same synchronous generator API.

This plan introduces the pipeline and migrates the existing 32 editable JSON
assets plus five static Next code snippets. Dynamic generator layers remain
unchanged and can adopt the pipeline in later, individually verified migrations.
This is an initial migration, not a promise to eliminate every source string.

## Current state

All paths below are relative to the repository root unless stated otherwise.

- `packages/create-gb-app/package.json:8` exports `./generate` directly from
  `src/generate/public.ts`. Next imports this source, rather than a separately
  built generator package. The package's `test` script is `bun test`; its
  `format` and `format:check` globs currently cover TS, TSX, Markdown and MDX.
- `packages/create-gb-app/src/types/generate.ts:4` defines
  `export type FileMap = Record<string, string>;`.
- `packages/create-gb-app/src/generate/build-tree.ts:284` exposes:

  ```ts
  export function buildTree(stack: Stack, ctx: GenerateContext): FileMap {
    validateStartOrpc(stack);
    return buildProject(stack, ctx, true);
  }
  ```

- `apps/web/features/create/lib/generate-files.ts:37` calls `buildTree` without
  awaiting it and returns its file map. Preserve that contract.
- `packages/create-gb-app/src/generate/files.ts:6` only ensures a final newline:

  ```ts
  files[path] = content.endsWith('\n') ? content : `${content}\n`;
  ```

- `packages/create-gb-app/src/generate/layers/next.ts:64` embeds this static code:

  ```ts
  import type { NextConfig } from 'next';

  const nextConfig: NextConfig = {};

  export default nextConfig;
  ```

  The same layer embeds PostCSS configuration, declaration files and CSS. Its
  layout and page also interpolate project names and conditional Notes links;
  those dynamic programs are explicitly outside this migration.

- `packages/create-gb-app/src/generate/assets/forms/source.ts:1` already uses
  portable JSON imports. Keep this consumer and its public shape:

  ```ts
  import formattedSource from './formatted-source.json';

  export const rhfFormAssets = formattedSource.rhf;
  export const tanstackFormAssets = formattedSource.tanstack;
  ```

- `layers/login.ts:35` replaces `__UI_PREFIX__` in form source; line 52 replaces
  `__PROJECT_NAME__` in page source. Preserve these exact tokens and the current
  escaping logic. These paths are relative to `src/generate/`.
- `layers/forms.ts:112` matches a particular function layout with
  `/  async function submitNote[\s\S]*?\n  }\n/`; line 125 recognizes the exact
  `"use client";` directive. `layers/shadcn.ts:338` also patches layout text.
  Do not reformat intermediate generator output or rewrite these transformations.
- `packages/create-gb-app/script/build.ts:62` compiles the CLI with `Bun.build`.
  Its script currently removes `dist` before building. A freshness failure must
  occur before that removal.
- `packages/create-gb-app/tsconfig.json:21` includes only `src`, `test`, `script`.
  Its JSX import source is OpenTUI, not the React runtime used by generated apps.
  Keep editable templates outside those directories and outside package typechecking.
- `packages/create-gb-app/eslint.config.mjs` enables typed project service.
  Exclude templates from that lint project rather than installing their app dependencies.
- `src/generate/assets/shadcn/README.md:3` identifies `shadcn/source.json` as
  untouched upstream evidence. Keep that file and its provenance intact.
- `CONTEXT.md` defines Create as the product at `/create`. Use that name in docs.

Match strict TypeScript, kebab-case names for new tooling, sentence-case headings,
and existing `bun:test` imports. Match the JSON consumer above and use
`test/generate-login.test.ts` and `test/generate-forms.test.ts` as verification
examples. No runtime dependency or custom template language is needed.

## Commands you will need

Run package commands from `packages/create-gb-app` unless otherwise stated.

```sh
# Existing baseline gates. Both passed during planning.
bun run typecheck
bun run lint --no-cache

# These seven files passed 52 tests during the advisory pass.
bun test test/files.test.ts test/generate-public.test.ts test/generate-layers.test.ts test/generate-forms.test.ts test/generate-login.test.ts test/generate-shadcn.test.ts test/generate-yes.test.ts

# Run from apps/web, so its Bun preload applies. Passed 24 tests during planning.
bun test features/create/lib/__test__/build-file-map.test.ts

# Existing full package suite, required after implementation.
bun run test
```

Use the already installed Bun 1.4.3 and repository Prettier. Do not install
framework dependencies for the template directory. New commands specified below
are implementation targets, not commands that already exist.

## Scope

Only modify or create these paths:

- `packages/create-gb-app/templates/**`, the 37 source files specified below and a README
- `packages/create-gb-app/script/templates.ts`, the serializer and freshness check
- `packages/create-gb-app/script/build.ts`, an early read-only freshness gate
- `packages/create-gb-app/src/generate/assets/next/source.json`, new generated asset
- `packages/create-gb-app/src/generate/assets/forms/formatted-source.json`
- `packages/create-gb-app/src/generate/assets/login/source.json`
- `packages/create-gb-app/src/generate/assets/shadcn/formatted-source.json`
- `packages/create-gb-app/src/generate/assets/shadcn/README.md`
- `packages/create-gb-app/src/generate/layers/next.ts`, static snippet replacements only
- `packages/create-gb-app/package.json`, scripts only
- `packages/create-gb-app/eslint.config.mjs`, template ignore only
- `packages/create-gb-app/README.md`, template authoring instructions
- `packages/create-gb-app/test/templates.test.ts`
- `packages/create-gb-app/test/template-output.test.ts` and its Bun snapshot file
- `docs/plan/README.md`, execution status only

Do not modify generator APIs, preset codes, dependency versions, app behavior,
dynamic layout/page emitters, transformation regexes, upstream shadcn reference
JSON, the workspace driver, root hooks/configuration, or web source. Do not add
AST libraries, loaders, runtime filesystem reads, runtime formatters, a watcher,
or placeholder/rendering abstractions. Keep manifests and existing config
generation unchanged. Do not run the upstream shadcn CLI to recapture assets.

## Git workflow

Implement in an isolated checkout when dispatched by a reviewer. A suitable
branch is `advisor/001-editable-generator-templates`. Existing history uses
Conventional Commits, for example `feat(create): extract and verify the Turborepo addon`.
Commit only if the operator requests it. Do not merge, push, publish or open a PR
without an instruction to do so.

## Steps

### Step 1: Capture generated output before changing its source representation

1. Run the existing baseline gates above. Stop if they fail before your edits.
2. Add `test/template-output.test.ts`. Use the public `buildTree` and
   `resolveStack` entry points, fixed project name `template-check`, and Bun as
   the package manager. Snapshot sorted file paths and per-file SHA-256 hashes.
   Before hashing TS, TSX, MJS, CSS and JSON source, normalize its formatting in
   memory with repository Prettier options and the emitted file path. Hash other
   files as emitted. Reuse the root's installed Prettier as a development tool;
   never introduce it into runtime generator imports. Fail on parse errors.
3. Cover these explicit raw flag cases:
   - `{ yes: true }`
   - `{ yes: true, form: 'react-hook-form' }`
   - `{ yes: true, form: 'tanstack-form' }`
   - `{ database: 'none', api: 'none', auth: 'none' }`
   - `{ frontend: 'tanstack-start', api: 'orpc', auth: 'none' }`
   - `{ frontend: 'tanstack-start', api: 'orpc', auth: 'better-auth' }`
   - `{ frontend: 'tanstack-start', api: 'orpc', auth: 'none', form: 'react-hook-form' }`
   - `{ frontend: 'tanstack-start', api: 'orpc', auth: 'none', form: 'tanstack-form' }`
   - `{ backend: 'hono', api: 'trpc', auth: 'none', form: 'react-hook-form' }`
   - `{ backend: 'hono', frontend: 'tanstack-start', api: 'trpc', auth: 'none', form: 'tanstack-form' }`
   - `{ backend: 'nest' }`
4. Create snapshots now, before migrating assets, with
   `bun test test/template-output.test.ts --update-snapshots`. Keep these baselines
   fixed for subsequent steps. This deliberately tolerates formatting-only changes,
   while retaining file ownership, literals, imports and application structure.
   Existing behavioral tests remain necessary; formatting hashes do not prove behavior.

**Verify:** `bun test test/template-output.test.ts` exits 0 for all 11 cases.
Do not update these snapshots after starting extraction.

### Step 2: Extract the existing JSON assets into ordinary source files

Create the following mappings. The left side is relative to the new package-root
`templates/` directory. The right side is relative to `src/generate/assets/`.

- `shadcn/<existing key>` maps to the identical flat key in
  `shadcn/formatted-source.json`. Extract all 13 keys, including `components.json`,
  `app/globals.css`, `lib/utils.ts`, the theme provider and nine UI components.
- `forms/rhf/<filename>` maps to `forms/formatted-source.json.rhf[filename]`.
  Extract its five files: `form-base.tsx`, `form-input.tsx`, `form-textarea.tsx`,
  `form-checkbox.tsx`, `form-select.tsx`.
- `forms/tanstack/<filename>` maps to `.tanstack[filename]` in that same JSON.
  Extract those five names plus `contexts.tsx` and `hooks.tsx`.
- `forms/notes/react-hook-form.tsx` and `forms/notes/tanstack-form.tsx` map to
  `.notes['react-hook-form']` and `.notes['tanstack-form']`, without the extension.
- `login/forms/{none,react-hook-form,tanstack-form}.tsx` maps to the corresponding
  extensionless keys in `login/source.json.forms`.
- `login/pages/{next,tanstack-start}.tsx` maps to the corresponding extensionless
  keys in `login/source.json.pages`.

Copy decoded string values, not JSON escape sequences. Preserve tokens and
behavior. Format these real files with the root Prettier configuration.
An in-memory check during planning found only the two `forms/notes/` source
values need formatting changes; all 32 assets parse successfully.

Add `templates/**` to the package ESLint global ignores. Do not widen the
TypeScript include list. The template directory is source text for other
applications, not part of the CLI's OpenTUI program.

**Verify:** `bunx --no-install prettier --check templates` exits 0, and
`bun run typecheck` and `bun run lint --no-cache` still exit 0. At this step the
original generated JSON remains available, so existing generation still works.

### Step 3: Add deterministic serialization and read-only freshness checking

Implement `script/templates.ts` using Node filesystem/path APIs already available
in Bun. Resolve paths from `import.meta.url` or `import.meta.dir`, not the caller's
working directory. Implement the three existing asset families first; add the
fourth, Next, in step 4. Do not create an empty placeholder output for that family.

- Recursively collect each family, sort relative keys deterministically, use `/`
  separators, read UTF-8 and normalize CRLF to LF. Preserve all other source text,
  including whitespace, backticks, dollar expressions and existing trailing newlines.
- Construct the existing nested JSON shapes above. Do not flatten forms or login
  assets. Emit `JSON.stringify(asset, null, 2) + '\n'`.
- Exclude the template README; fail on unexpected files or directory shapes so
  authored code cannot silently disappear. Reject symlinks rather than following
  files outside the declared template roots. Missing files must either change the
  generated map and fail freshness or produce a useful error.
- Normal invocation writes the declared generated outputs only when their contents
  differ. `--check` computes exactly the same expected contents, compares without
  writing, identifies stale/missing outputs and exits nonzero on a mismatch.
- Do not format or execute source during serialization. Formatting happens when
  authors edit files or invoke Prettier. The generated JSON is committed.
- A small exported collection/serialization function accepting a template root
  may be used by tests. Keep CLI execution behind `import.meta.main`. Do not
  expose the tooling through `create-gb-app/generate`.

Add package scripts `templates:generate` = `bun script/templates.ts` and
`templates:check` = `bun script/templates.ts --check`. Regenerate the existing
three asset outputs now; extend the serializer for Next in the next step. Consumers
continue importing the same JSON paths and shapes.

**Verify:** `bun run templates:generate` followed by `bun run templates:check`
exits 0; a second generation makes no additional changes. Run
`bun test test/template-output.test.ts test/generate-forms.test.ts test/generate-login.test.ts test/generate-shadcn.test.ts`.
All pass against the original snapshots without updates.

### Step 4: Migrate five static Next snippets through the same pipeline

Add `templates/next/` containing these five real source files:

- `next.config.ts`
- `postcss.config.mjs`
- `next-env.template.d.ts`, mapped to output key `next-env.d.ts`
- `global.d.ts`
- `app/globals.css`

The declaration template uses a different basename because the repository's
global `next-env.d.ts` ignore would otherwise hide it from Git. Do not modify
the root ignore file or force-add an ignored template.

Copy their current literal contents from `layers/next.ts`, format them, and
populate `assets/next/source.json` with their output names as flat keys.
Import this JSON in `layers/next.ts` and replace only the five corresponding
content arguments to `setFile`. Leave dependency setup, file paths, order of
operations, dynamic JSX/layout strings, tsconfig and gitignore text unchanged.
Do not add a wrapper around ordinary JSON property access.

**Verify:** Regenerate assets and run `bun run templates:check`,
`bun test test/template-output.test.ts test/generate-public.test.ts test/generate-yes.test.ts`,
and `git check-ignore templates/next/next-env.template.d.ts`.
Tests pass without snapshot updates; `git check-ignore` exits 1 with no output,
meaning the file is trackable. `bun run typecheck` exits 0.

### Step 5: Make stale assets fail early and document the workflow

- Change the package test script to `bun run templates:check && bun test`.
- Make `script/build.ts` call the read-only freshness function before removing
  `dist`, installing optional native packages or invoking `Bun.build`. A direct
  invocation of the build script must receive the same guard.
- Keep existing format globs and add template CSS, MJS and JSON to both `format`
  and `format:check`. Append the freshness check after Prettier in
  `format:check`; do not make a check command repair generated files.
- Document editing templates, formatting, running `templates:generate`, reviewing
  the source plus JSON diff and running checks. Explain that JSON is generated
  and committed, and formatting templates does not format every final generated
  file after its later transformations.
- Update the shadcn asset README to distinguish untouched upstream `source.json`,
  editable templates, and the generated consumed `formatted-source.json`.
- Do not change root lint-staged hooks, add a watcher or make normal web startup
  regenerate files. Committed assets let the existing Next source import work
  with no preparatory build. Root Turbo test tasks already delegate package tests.

**Verify:** `bun run test`, `bun run typecheck`, `bun run lint --no-cache`, and
`bun run format:check` all exit 0. From `apps/web`, run the preview test command
listed above; it must pass without web source edits.

### Step 6: Prove the serializer's behavior and the compiled CLI boundary

Add `test/templates.test.ts`, using Bun tests and temporary directories with
cleanup in `finally`. Test the actual serializer rather than a second copy.

- Round-trip quotes, backslashes, backticks, literal `${expression}`, Unicode,
  blank lines and trailing newlines through JSON serialization.
- Cover CRLF input, stable ordering, nested paths and the precise four output
  shapes, including extensionless form/login keys and the declaration rename.
- Prove `--check` accepts current assets, rejects stale and missing outputs,
  and leaves file contents and mtimes unchanged. Reject an unknown argument and
  unexpected input paths with nonzero status and a useful message.
- Prove editing, adding or removing a valid template changes expected output.
- Keep freshness testing in temporary fixture trees; do not corrupt the real
  source tree to exercise failures. Mock neither filesystem reads nor JSON parsing.

**Verify:** Run all gates from step 5. Then run `bun script/build.ts --skip-install`
in the executor checkout. It must build the host binary and pass its existing
`--help` smoke test. Locate the host binary under the package's `dist/` using
`hostTarget`, `platformPackageName` and `binaryFileName` in `script/targets.ts`.
Run that binary from an OS temporary working directory with
an absolute destination and `--yes --no-install --no-git`; assert exit 0 and
that emitted `next.config.ts` and a form/UI asset match `buildTree` for the same
project name and manager. Clean up the fixture. This exercises embedded JSON
without relying on template files relative to the current working directory.
Do not publish binaries or run application dependency installation.

## Test plan

The new serializer tests protect escaping, deterministic output and genuinely
read-only checking. The 11 fixed pre-migration snapshots protect assembled file
maps across the affected layouts. Existing form tests exercise submission
behavior and existing login tests check TSX diagnostics; retain both.

Full generated-application builds, database setup and browser CRUD are deferred
because this migration retains behavior and existing transformation code.
Escalate to the existing `verify:generated` workflow if a behavior change becomes
necessary, rather than treating a snapshot update as proof that it is safe.

## Done criteria

- [x] Exactly 37 authored code/config template files exist with the mappings above.
- [x] Committed assets pass `templates:check` without regeneration, including simulated CRLF checkout coverage.
- [x] Repeated `templates:generate` produces identical files.
- [x] Serializer tests pass, including stale-check no-write assertions.
- [x] All 11 pre-migration generation snapshots pass without updates.
- [x] Package tests, typecheck and no-cache lint exit 0; changed/new files pass formatting checks.
- [ ] Package-wide strict format check exits 0. Existing failures in untouched files are documented in the index.
- [x] The Create preview tests pass and the host binary generates from another cwd.
- [x] No runtime generator file imports filesystem/formatter tooling for this feature.
- [x] Public exports, dependency declarations and preset behavior remain unchanged; package scripts were updated as planned.
- [x] `git diff --name-only` and `git ls-files --others --exclude-standard` show
      changes only in the scope above. Required templates are not ignored by Git.
- [x] `docs/plan/README.md` records completion and actual verification results.

## STOP conditions

Stop and report instead of widening scope if:

- Existing asset keys or quoted current-state code have changed since planning.
- A valid baseline case fails before extraction, or a baseline snapshot changes
  afterward for a reason beyond formatting that Prettier already normalizes.
- Extraction requires changing placeholder semantics, regex patches, application
  behavior, supported stacks or the synchronous public API.
- Formatting changes more source assets than the two identified Notes forms
  without a concrete explanation from the installed formatter/configuration.
- The host build lacks its existing native dependencies; report that prerequisite
  instead of changing dependency versions or installing for every platform.
- A verification gate still fails after two reasonable correction attempts, or
  an out-of-scope file must change.

## Maintenance notes

Edit templates and regenerate their JSON in the same change. Keep the serializer
out of the runtime import graph. Reviewers should inspect authored source first
and use freshness checks to validate generated JSON. Keep upstream shadcn
reference provenance separate from local authoring files.

Future dynamic-layer migrations need their own output baselines. Preserve
context-specific escaping and existing `.js` import suffixes; JSON serialization
escapes an asset container but does not sanitize values interpolated into emitted
programs. Runtime final-output formatting and removal of formatting-sensitive
patches are separate work, intentionally deferred here.
