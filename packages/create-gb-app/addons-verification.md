# Addons and workspace verification

This report covers tasks 3–5, implemented on `feat/create-addons-monorepos` from `0ae2344fca80d2443de8da3e5914877b9d4eea23`. Tasks 1–2 are the baseline. Checks ran on Windows with Node.js 24.11.1 and Bun 1.4.3. Each installed fixture lives outside the host repository and has its own lockfile, ports, and disposable database where needed.

Evidence identifiers below name directories under `%TEMP%`; logs and metadata are in each directory's `evidence/` folder. They are local artifacts, not committed application dependencies. `revision.txt`, `result.json`, stage logs, and the selected manager's lockfile record the actual run. Later runs additionally record generated-file hashes, startup readiness, check completion, and port cleanup. Generated files come from the working tree at verification time; the revision alone does not describe uncommitted changes.

## Package-manager acceptance

The representative application is a database-free Hono/Next monorepo with separate application processes, shared UI, and compiled validation. All entries passed clean install, root build, typecheck, lint, start, dev, and shutdown. Importing the compiled validation package from the web workspace also passed for every entry; that check is retained in `workspace-import.json` for earlier runs. Shell readiness checks exercise HTTP startup, without claiming Notes CRUD on a database-free configuration.

| Manager                | Plain evidence                | Turbo evidence                |
| ---------------------- | ----------------------------- | ----------------------------- |
| Bun                    | `create-gb-hono-shell-IRnt3N` | `create-gb-hono-shell-DALrrt` |
| npm                    | `create-gb-hono-shell-IV4Dcn` | `create-gb-hono-shell-93pAT8` |
| pnpm                   | `create-gb-hono-shell-e3MMgn` | `create-gb-hono-shell-PtX7Zg` |
| Yarn 4.11 via Corepack | `create-gb-hono-shell-sBoWEX` | `create-gb-hono-shell-t25H6F` |

Manager versions and resolved dependencies belong to the retained fixture logs/lockfiles. This matrix does not assert runtime support for every provider or every stack combination with every manager.

## Bun topology checks

These database-free cases passed install, root build/typecheck/lint, root production and development startup, and cleanup in each mode.

| Frontend | Backend  | Plain evidence                           | Turbo evidence                           |
| -------- | -------- | ---------------------------------------- | ---------------------------------------- |
| Next     | Built-in | `create-gb-next-shell-workspace-zCRhve`  | `create-gb-next-shell-workspace-8WLWI9`  |
| Start    | Built-in | `create-gb-start-shell-workspace-wsPZE6` | `create-gb-start-shell-workspace-hv7lcC` |
| Next     | Nest     | `create-gb-nest-shell-WQ1DcZ`            | `create-gb-nest-shell-w7D7sB`            |
| Start    | Nest     | `create-gb-nest-shell-IQVia7`            | `create-gb-nest-shell-JfnIcr`            |
| Next     | Hono     | `create-gb-hono-shell-IRnt3N`            | `create-gb-hono-shell-DALrrt`            |
| Start    | Hono     | `create-gb-hono-shell-XcMkM0`            | `create-gb-hono-shell-X7X4kY`            |

Relational Nest/Start additionally exercises root Prisma generation/schema application, production HTTP Notes and Better Auth, root development startup, and package-owned environment files. Plain evidence is `create-gb-nest-nvuts9`; Turbo evidence is `create-gb-nest-8tazHf`. The `--local-env` phase replaces generated server placeholders and removes database/auth variables from the parent process, so inherited credentials cannot conceal an ownership failure.

## Start/oRPC regressions

Public and Better Auth workspaces exercise root database commands, build/typecheck/lint, production and development HTTP Notes, browser CRUD/validation/retry, SSR/hydration, and cleanup. Private cases also exercise anonymous rejection, ownership, concurrent request isolation, and account changes.

| Case                  | Plain evidence                               | Turbo evidence                               |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| Public workspace      | `create-gb-start-orpc-workspace-WuuLbN`      | `create-gb-start-orpc-workspace-OS1IeS`      |
| Better Auth workspace | `create-gb-start-orpc-workspace-auth-LlRCkG` | `create-gb-start-orpc-workspace-auth-aFSsgf` |

Single-application public/authenticated variants and both supported form libraries passed the existing HTTP/browser workflow, including installation, database preparation, build, typecheck, lint, and cleanup.

| Case                          | Evidence                                         |
| ----------------------------- | ------------------------------------------------ |
| Public                        | `create-gb-start-orpc-pCZmQr`                    |
| Better Auth                   | `create-gb-start-orpc-auth-kQbxqS`               |
| React Hook Form public        | `create-gb-start-orpc-rhf-Z0eDXE`                |
| React Hook Form authenticated | `create-gb-start-orpc-rhf-auth-g8eR9t`           |
| TanStack Form public          | `create-gb-start-orpc-tanstack-form-BvPGX5`      |
| TanStack Form authenticated   | `create-gb-start-orpc-tanstack-form-auth-PAC8hu` |
| ESLint public                 | `create-gb-start-orpc-eslint-Wn4mog`             |

The account-switch browser check now intercepts its delayed old-account request once. The previous persistent interception also caught the next account's read and produced a false failure. The authenticated React Hook Form retry passed with the corrected verifier.

## Cache and lifecycle checks

`create-gb-hono-shell-DALrrt/evidence/turbo-cache.json` records a repeated build cache hit, restoration of a deleted compiled artifact with identical contents, and invalidation from shared source, process environment, and local `.env.local` changes. Disposable output probes verify the rebuilt HTML and compiled module contents. Source changes are restored after this phase. These are correctness checks; no performance improvement or remote-cache behavior is claimed.

`create-gb-hono-shell-TyxJmj/evidence/workspace-lifecycle.json` records a failed dependency preventing application startup, an application failure stopping its running sibling, interruption exit status 130, released ports, and all seven observed owned processes terminating. The generated path contains spaces. Windows interruption uses a fixture-only preload to emit SIGINT inside the driver; physical console Ctrl+C delivery was not tested.

## Public boundaries and host integration

Generator tests cover plain/Turbo output across both frontends, all four backend topologies, and all four managers. They compare application files between modes, check ownership and the absence of Turbo artifacts in plain output, and retain existing generation gaps. Codec and CLI/Create tests cover historical literal presets/URLs, nested addon validation, explicit overrides, and copied-command/preview parity.

The live Create session at `https://gbaolt.localhost/create` checked grouped addons, fresh Nest plain defaults, explicit Turbo preview/reload, historical URL import, invalid-schema reset, form dependency preview, and linting preview invalidation with sibling selections preserved. No browser page errors occurred. The shared T3 preview snapshot timed out twice; the installed Playwright workflow supplied the browser checks.

The full generator suite passed 281 tests across 31 files, and the web suite passed 120 tests across 16 files. Both suites passed again after restoring the missing files on October 16, 2026. Generator and web typechecks and scoped generator/Create lint passed. The manual standards and spec review against the starting revision found no remaining issues; no subagents were used. The ESLint public, authenticated React Hook Form, and authenticated TanStack Form fixture output hashes match the recovered generator, and all three record successful completion and released ports.

The host Next production build passed, including `/create`. The aggregate root build was stopped while the CLI task was downloading all-platform OpenTUI dependencies. Native Windows CLI compilation with `bun script/build.ts --skip-install` and its `--help` smoke check then passed. The aggregate root build is not reported as passing.

## Limits

Unix execution and live Convex/provider-backed setup remain unverified: this environment has no WSL/Docker or disposable Convex account. Generated Convex ownership, codegen/dev forwarding, and prerequisites are covered by public generation tests. The current Start/oRPC workspace form-library gap remains enforced. Hosted database provisioning, remote caching, and new integration combinations are outside this work.
