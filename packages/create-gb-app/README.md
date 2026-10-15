# create-gb-app

```sh
npx create-gb-app my-gb-app --yes
pnpm create gb-app my-gb-app --yes
bunx create-gb-app my-gb-app --yes
```

```sh
npx create-gb-app my-gb-app --frontend next --backend self --api orpc
npx create-gb-app my-gb-app --backend nest
npx create-gb-app my-gb-app --backend convex --frontend tanstack-start --auth clerk
npx create-gb-app my-gb-app --frontend tanstack-start --backend self --api trpc --auth none --linter oxlint
npx create-gb-app my-gb-app --frontend tanstack-start --backend self --api orpc --auth none --linter oxlint
```

`--yes` writes the default stack: Next, Self, oRPC, Postgres, Prisma, Better Auth, shadcn, ESLint, payments none, db-setup none. Flags after `--yes` override those defaults.

```sh
npx create-gb-app my-gb-app --yes --preset nest
npx create-gb-app my-gb-app --yes --preset gb0 --frontend tanstack-start
```

`--preset` expands to stack flags. Named values `nest`, `start`, and `convex` are aliases. Compact codes start with `gb`. Explicit stack flags overlay the preset.

## Configuration and addons

The selected Configuration keeps architecture fields at the top level and optional selections in `addons`. Project name and package manager remain separate generation inputs.

```ts
const configuration = {
  ...YES_DEFAULTS,
  addons: {
    toolchain: 'standard',
    taskRunner: 'auto',
    linting: 'auto',
    form: 'none',
  },
};
```

Standard tooling resolves automatic linting to ESLint and the automatic task runner to no additional runner. New codes use `gb-v2-`; historical compact and `gb-v1-` codes retain their original choices, including Turbo workspaces. Create URLs use `schema=2` to distinguish the new defaults from historical links.

CLI flags remain flat: `--toolchain`, `--task-runner`, `--linting`, and `--form`. `--linter` remains a linting alias. `--structure turborepo` remains an alias for a monorepo with the Turbo addon. Explicit modern flags win aliases, and overriding one addon keeps its siblings.

New monorepos use plain workspace commands by default. Nest and Hono require a monorepo but do not require Turbo. Select `--task-runner turborepo` to opt in. The generated plain command driver requires Node.js 22.12 or newer, builds shared dependencies before consumers, starts applications together, and forwards database commands to their owning workspace. Use the selected package manager to invoke root scripts. Vite+ is not implemented.

## Verify generated applications

Set `FIXTURE_DATABASE_URL` to a disposable PostgreSQL cluster with permission to create databases for relational cases. The verifier creates and drops a unique database for each run. It generates an application in the operating system's temporary directory, installs, initializes Prisma when selected, builds, typechecks, lints, starts the application, and exercises Notes through its real HTTP client. Shell cases need no database.

```sh
bun run --filter create-gb-app verify:generated next
bun run --filter create-gb-app verify:generated start-trpc
bun run --filter create-gb-app verify:generated nest
bun run --filter create-gb-app verify:generated start-orpc
bun run --filter create-gb-app verify:generated start-orpc-eslint
bun run --filter create-gb-app verify:generated start-orpc-auth
bun run --filter create-gb-app verify:generated start-orpc-rhf
bun run --filter create-gb-app verify:generated start-orpc-rhf-auth
bun run --filter create-gb-app verify:generated start-orpc-tanstack-form
bun run --filter create-gb-app verify:generated start-orpc-tanstack-form-auth
bun run --filter create-gb-app verify:generated start-orpc-workspace
bun run --filter create-gb-app verify:generated start-orpc-workspace-auth
bun run --filter create-gb-app verify:generated hono-shell --runner=none --manager=npm
bun run --filter create-gb-app verify:generated nest-shell --runner=none --frontend=tanstack-start
bun run --filter create-gb-app verify:generated next-shell-workspace --runner=none
bun run --filter create-gb-app verify:generated start-shell-workspace --runner=none
bun run --filter create-gb-app verify:generated hono-shell --runner=none --manager=yarn --corepack
bun run --filter create-gb-app verify:generated hono-shell --runner=none --spaces --lifecycle
```

The printed evidence directory contains stage logs, startup commands, owned process IDs, manager and runtime versions, the generator revision, configuration, resolved dependencies, generated-file hashes, port cleanup results, and the fixture lockfile. Failed stages exit with a nonzero status. Completion, failure, SIGINT, and SIGTERM clean up owned command trees and the disposable database; generated files and evidence remain available for inspection. This workflow requires Bun and Node.js 22.12 or newer. The portfolio site's server and database are separate.

Choose `--runner=none` or `--runner=turborepo`, and `--manager=bun|npm|pnpm|yarn`. `--corepack` invokes the selected manager through Corepack. `--lifecycle` temporarily replaces scripts in the disposable fixture to check dependency failures, sibling cleanup, and interruption, then restores them. On Windows the interruption check injects a SIGINT event into the driver; it does not simulate a console Ctrl+C keypress. Plain Hono/Next commands have been exercised on Windows with all four managers, and both frontends with Nest, Hono, and the built-in backend using Bun. Unix execution and live Convex deployment remain unverified.

The generated oRPC client, server, contract, OpenAPI, Nest, and Query integrations use `2.0.0-beta.43`. Start uses `1.168.61` with Router `1.170.42` and Router core `1.171.35` to retain Vite 7 compatibility and a single compatible router type registration. The generator's other dependency ranges remain unchanged. Runtime evidence describes the resolved fixture lockfile, not every possible future resolution of those ranges.

## Start with the built-in oRPC backend

The verified Configuration uses a single application, PostgreSQL, Prisma, no hosted database setup, no payments, disabled authentication or Better Auth, and the plain Notes form, React Hook Form, or TanStack Form. It includes list, create, edit, and delete operations, shared server validation, SSR-prefetched Notes, and Query hydration. The CLI and Create preview return a specific generation gap for other combinations until they are verified. Existing separate-backend integrations retain their own support.

The browser uses the same-origin RPC endpoint. SSR calls the router in process with request-local headers. Each router creates its own QueryClient; fresh server data remains fresh for 60 seconds after hydration, and successful mutations invalidate the Notes list.

Install the verification browser with `bun x playwright install chromium`. Start/oRPC fixture commands also exercise browser CRUD, validation, a rejected network save and retry, query invalidation, and hydration without an immediate duplicate read. Browser automation is a development dependency of the generator, not a dependency of generated applications.

With Better Auth, the generated application includes email/password signup, signin, and signout. Notes ownership comes from the server session on every RPC operation. Private pages and RPC responses use `private, no-store`. Set `BETTER_AUTH_URL` to the application's origin and replace the example auth secret before deployment. Signin, signout, and observed account changes cancel private queries, clear the cache, and load a fresh document so previous route state cannot cross identities. The authenticated verifier also checks direct anonymous rejection, two-user ownership, concurrent SSR isolation, and switching accounts while a private response is in flight.

Optional form libraries use the same typed create/update/delete operations and session checks. The Notes form accepts initial values for editing and retains entered values after a failed submission. A successful save refreshes the list before resetting the form. The selected library also supplies the authenticated login form; applications do not include the other form library's dependencies.

Monorepos support the same PostgreSQL/Prisma public and Better Auth applications with the plain form. The fullstack server and database stay in the web application, alongside its local environment file. Root database, build, and development tasks use that environment and build shared validation before starting the web application. Optional form libraries in this layout remain an explicit generation gap. Public and authenticated Bun workspace fixtures run end to end in plain mode; the separate Hono/Next shell also verifies npm, pnpm, and Yarn commands.

Start workspaces generated for Bun use its hoisted install layout. This keeps Vite's module identity consistent between the CLI and Start's development plugin. Workspace verification exercises root database commands, the production application, and root development startup with real HTTP Notes scenarios.

Append `--hold` to a fixture command to keep the built application and disposable database running for browser checks for up to 15 minutes. The verifier prints its origin and the release-file location. Creating that file triggers cleanup immediately.
