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

`--yes` writes the default stack: Next, Self, oRPC, Postgres, Prisma, Better Auth, shadcn, ESLint plus Prettier, payments none, db-setup none. Flags after `--yes` override those defaults.

```sh
npx create-gb-app my-gb-app --yes --preset nest
npx create-gb-app my-gb-app --yes --preset gb0 --frontend tanstack-start
```

`--preset` expands to stack flags. Named values `nest`, `start`, and `convex` are aliases. Compact codes start with `gb`. Explicit stack flags overlay the preset.

## Verify generated applications

Set `FIXTURE_DATABASE_URL` to a disposable PostgreSQL cluster with permission to create databases. The verifier creates and drops a unique database for each run. It generates an unmodified application in the operating system's temporary directory, installs with Bun, initializes Prisma, builds, typechecks, starts the application, and exercises Notes through its real HTTP client.

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
```

The printed evidence directory contains stage logs, the generator revision, Configuration, resolved dependencies, and the fixture lockfile. Failed stages exit with a nonzero status. Application processes and the disposable database are cleaned up; generated files and evidence remain available for inspection. This workflow requires Bun and Node.js 22.12 or newer. The portfolio site's server and database are separate.

The generated oRPC client, server, contract, OpenAPI, Nest, and Query integrations use `2.0.0-beta.43`. Start uses `1.168.61` with Router `1.170.42` and Router core `1.171.35` to retain Vite 7 compatibility and a single compatible router type registration. The generator's other dependency ranges remain unchanged. Runtime evidence describes the resolved fixture lockfile, not every possible future resolution of those ranges.

## Start with the built-in oRPC backend

The verified Configuration uses a single application, PostgreSQL, Prisma, no hosted database setup, no payments, disabled authentication or Better Auth, and the plain Notes form, React Hook Form, or TanStack Form. It includes list, create, edit, and delete operations, shared server validation, SSR-prefetched Notes, and Query hydration. The CLI and Create preview return a specific generation gap for other combinations until they are verified. Existing separate-backend integrations retain their own support.

The browser uses the same-origin RPC endpoint. SSR calls the router in process with request-local headers. Each router creates its own QueryClient; fresh server data remains fresh for 60 seconds after hydration, and successful mutations invalidate the Notes list.

Install the verification browser with `bun x playwright install chromium`. Start/oRPC fixture commands also exercise browser CRUD, validation, a rejected network save and retry, query invalidation, and hydration without an immediate duplicate read. Browser automation is a development dependency of the generator, not a dependency of generated applications.

With Better Auth, the generated application includes email/password signup, signin, and signout. Notes ownership comes from the server session on every RPC operation. Private pages and RPC responses use `private, no-store`. Set `BETTER_AUTH_URL` to the application's origin and replace the example auth secret before deployment. Signin, signout, and observed account changes cancel private queries, clear the cache, and load a fresh document so previous route state cannot cross identities. The authenticated verifier also checks direct anonymous rejection, two-user ownership, concurrent SSR isolation, and switching accounts while a private response is in flight.

Optional form libraries use the same typed create/update/delete operations and session checks. The Notes form accepts initial values for editing and retains entered values after a failed submission. A successful save refreshes the list before resetting the form. The selected library also supplies the authenticated login form; applications do not include the other form library's dependencies.

Append `--hold` to a fixture command to keep the built application and disposable database running for browser checks for up to 15 minutes. The verifier prints its origin and the release-file location. Creating that file triggers cleanup immediately.
