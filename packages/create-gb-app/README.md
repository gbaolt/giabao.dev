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
```

The printed evidence directory contains stage logs, the generator revision, Configuration, resolved dependencies, and the fixture lockfile. Failed stages exit with a nonzero status. Application processes and the disposable database are cleaned up; generated files and evidence remain available for inspection. This workflow requires Bun and Node.js 22.12 or newer. The portfolio site's server and database are separate.

The generated oRPC client, server, contract, OpenAPI, Nest, and Query integrations use `2.0.0-beta.43`. Start uses `1.168.61` with Router `1.170.42` and Router core `1.171.35` to retain Vite 7 compatibility and a single compatible router type registration. The generator's other dependency ranges remain unchanged. Runtime evidence describes the resolved fixture lockfile, not every possible future resolution of those ranges.
