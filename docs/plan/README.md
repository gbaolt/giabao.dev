# Implementation plans

Prepared with Improve on 2026-10-16 against commit `c30645a`.
The selected scope is editable template files plus generated JSON assets.
Read the plan fully before implementation and honor its STOP conditions.

## Execution order and status

| Plan                                       | Title                                            | Priority | Effort | Depends on | Status |
| ------------------------------------------ | ------------------------------------------------ | -------- | ------ | ---------- | ------ |
| [001](001-editable-generator-templates.md) | Author generator assets as editable source files | P1       | M      | None       | DONE   |

Status values: TODO, IN PROGRESS, DONE, BLOCKED with a reason, or REJECTED with a rationale.

## Dependency notes

Plan 001 first captures generated-output baselines, then introduces the serializer,
migrates the 32 existing JSON assets and five static Next snippets, and verifies
both consumers. No other plan is required. Dynamic generator layers can migrate
through this pipeline in later changes with their own baselines.

## Findings considered and rejected

- Runtime final-output formatting is deferred by the user's selected scope. It
  also requires a separate decision about asynchronous formatting and the shared
  synchronous generator API.
- An AST generator or general template engine adds machinery that static source
  files and existing JSON imports do not require.
- Bun-only raw imports would require a separate compatibility solution for the
  Next.js source consumer. Existing JSON imports work in both environments.
- Rewriting transformation regexes is excluded from the initial migration. The
  plan protects their current behavior with output and integration checks.
- Migrating every dynamic layer at once is deferred to keep changes reviewable
  and avoid mixing source extraction with interpolation and behavior changes.

## Verification record

Implemented on 2026-10-16 on the existing `staging` branch. The plan and index
moved from `plans/` into this directory at the user's request.

- `bun run test` at the repository root passed both package suites, including
  301 generator tests and the 11 unchanged pre-migration snapshots.
- `bun run typecheck` at the root passed the generator, web and web test projects.
- Package no-cache ESLint passed. All 50 changed/new package code, documentation
  and asset files passed in-memory Prettier checks.
- `templates:check` passed. Serializer tests cover escaping, stable ordering,
  additions/removals, missing/stale assets, no-write checks, CRLF checkouts,
  declaration collisions, rejected paths/symlinks and invocation from another cwd.
- The host Windows x64 CLI built with `--skip-install` and passed `--help`.
  Running it from a temporary directory with `--yes --no-install --no-git`
  succeeded; five emitted files matched the public generator exactly.
- The 24 focused Create preview tests also passed separately.

The package-wide strict `format:check` remains red on pre-existing formatting.
CRLF checkout files account for most warnings; preserving line endings still
reports six untouched files: `src/generate/errors.ts`, `src/preset.ts`,
`src/preview/tree.ts`, `src/tui/app.tsx`, `test/generate-hono.test.ts`, and
`test/generate-workspaces.test.ts`. Their formatting failures were confirmed
against `c30645a` in memory. No unrelated files were reformatted.

## Ponytail review

What this change does: Authors 37 generator assets as editable source files and
serializes them into committed JSON. Builds and tests check freshness while the
CLI and Create keep their existing synchronous API.

Looks good. Ship. Reviewed the serializer, its build/CLI/test callers, JSON
consumers, source extraction, output baselines and authoring instructions.
Expected load is a developer or build process checking a small template tree.
No must-fix, should-fix or lean findings remain.

Not checked: Full generated-application builds with dependencies, live databases,
browser CRUD and non-Windows compiled binaries. These remain outside this
representation-only migration.
