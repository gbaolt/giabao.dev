import { expect, test } from 'bun:test';

import {
  buildTree,
  decodePreset,
  encodePreset,
  resolveStack,
  YES_DEFAULTS,
} from '#/generate/public';

test('Turso Prisma starter separates hosted runtime from local migration tooling', () => {
  const files = buildTree(
    resolveStack({
      database: 'sqlite',
      dbSetup: 'turso',
      orm: 'prisma',
      auth: 'none',
    }),
    { projectName: 'hosted', packageManager: 'bun' }
  );
  expect(files['lib/db.ts']).toContain('PrismaLibSQL');
  expect(files['lib/db.ts']).toContain('TURSO_AUTH_TOKEN');
  expect(files['prisma/schema.prisma']).toContain('env("LOCAL_DATABASE_URL")');
  const pkg = JSON.parse(files['package.json']);
  expect(pkg.dependencies['@prisma/adapter-libsql']).toBeDefined();
  expect(pkg.scripts['db:migrate']).toBe('prisma migrate dev');
  expect(pkg.scripts['db:push']).toBeUndefined();
  expect(files['README.md']).toContain('turso db shell');
});

test('Turso Drizzle starter emits libSQL tooling for hosted SQLite', () => {
  const files = buildTree(
    resolveStack({
      database: 'sqlite',
      dbSetup: 'turso',
      orm: 'drizzle',
      auth: 'none',
    }),
    { projectName: 'hosted', packageManager: 'bun' }
  );
  expect(files['lib/db.ts']).toContain('drizzle-orm/libsql');
  expect(files['lib/db.ts']).toContain('TURSO_AUTH_TOKEN');
  expect(files['drizzle.config.ts']).toContain('dialect: "turso"');
  expect(files['drizzle.config.ts']).toContain('TURSO_AUTH_TOKEN');
  const pkg = JSON.parse(files['package.json']);
  expect(pkg.dependencies['@libsql/client']).toBeDefined();
  expect(pkg.dependencies['better-sqlite3']).toBeUndefined();
  expect(pkg.scripts['db:migrate']).toBe('drizzle-kit migrate');
});

for (const dbSetup of ['planetscale', 'prisma-postgres'] as const) {
  for (const orm of ['prisma', 'drizzle'] as const) {
    test(`${dbSetup} ${orm} separates pooled runtime and direct schema connections`, () => {
      const files = buildTree(resolveStack({ dbSetup, orm, auth: 'none' }), {
        projectName: 'hosted',
        packageManager: 'bun',
      });
      expect(files['.env.example']).toContain('DIRECT_URL=');
      expect(
        files[orm === 'prisma' ? 'prisma/schema.prisma' : 'drizzle.config.ts']
      ).toContain('DIRECT_URL');
      expect(files['lib/db.ts']).not.toContain('DIRECT_URL');
      expect(files['README.md']).toContain('pooled');
    });
  }
}

for (const orm of ['prisma', 'drizzle'] as const) {
  test(`PlanetScale MySQL ${orm} uses TCP and development-branch schema guidance`, () => {
    const files = buildTree(
      resolveStack({
        database: 'mysql',
        dbSetup: 'planetscale',
        orm,
        auth: 'none',
      }),
      { projectName: 'hosted', packageManager: 'bun' }
    );
    expect(files['.env.example']).toContain('mysql://');
    expect(files['README.md']).toContain('deploy request');
    expect(files['README.md']).toContain('foreign key');
    expect(
      files[orm === 'prisma' ? 'prisma/schema.prisma' : 'lib/schema.ts']
    ).toContain(
      orm === 'prisma' ? 'provider = "mysql"' : 'varchar("id", { length: 191 })'
    );
  });
}

test('hosted setups serialize with stable slot IDs and preserve literal legacy presets', () => {
  expect(decodePreset('gb0')).toEqual({
    frontend: 'next',
    backend: 'self',
    structure: 'single',
    api: 'orpc',
    database: 'postgres',
    orm: 'prisma',
    dbSetup: 'none',
    auth: 'better-auth',
    payments: 'none',
    addons: {
      toolchain: 'standard',
      taskRunner: 'none',
      linting: 'eslint',
      form: 'none',
    },
  });
  expect(decodePreset('gb2').backend).toBe('nest');
  for (const dbSetup of ['turso', 'planetscale', 'prisma-postgres'] as const) {
    const flags = {
      ...YES_DEFAULTS,
      dbSetup,
      database:
        dbSetup === 'turso' ? ('sqlite' as const) : ('postgres' as const),
    };
    expect(decodePreset(encodePreset(flags))).toEqual(flags);
  }
});

test('incompatible hosted selections reject with stable rules', () => {
  for (const [database, dbSetup, rule] of [
    ['postgres', 'turso', 'turso-requires-sqlite'],
    ['sqlite', 'planetscale', 'planetscale-requires-postgres-or-mysql'],
    ['mysql', 'prisma-postgres', 'prisma-postgres-requires-postgres'],
    ['none', 'turso', 'db-setup-requires-database'],
  ] as const) {
    expect(() => resolveStack({ database, dbSetup, auth: 'none' })).toThrow(
      rule
    );
  }
  expect(() => resolveStack({ backend: 'convex', dbSetup: 'turso' })).toThrow(
    'convex-db-setup-off'
  );
});

test('Hono Turso runtime driver and schema tasks belong to the server workspace', () => {
  const files = buildTree(
    resolveStack({
      backend: 'hono',
      database: 'sqlite',
      dbSetup: 'turso',
      orm: 'prisma',
      auth: 'none',
    }),
    { projectName: 'hosted', packageManager: 'npm' }
  );
  const root = JSON.parse(files['package.json']);
  const server = JSON.parse(files['apps/server/package.json']);
  expect(server.dependencies['@prisma/adapter-libsql']).toBeDefined();
  expect(root.dependencies['@prisma/adapter-libsql']).toBeUndefined();
  expect(server.scripts['db:migrate']).toBe('prisma migrate dev');
  expect(server.scripts['db:push']).toBeUndefined();
  expect(files['apps/server/.env.example']).toContain('LOCAL_DATABASE_URL');
  expect(files['README.md']).toContain('apps/server');
});

test('self Drizzle Notes uses selected driver and an authenticated Notes repository', () => {
  const files = buildTree(
    resolveStack({
      database: 'sqlite',
      dbSetup: 'turso',
      orm: 'drizzle',
      auth: 'better-auth',
      api: 'none',
    }),
    { projectName: 'hosted', packageManager: 'bun' }
  );
  expect(files['app/notes/actions.ts']).toContain('notesStore.create');
  expect(files['app/notes/actions.ts']).not.toContain('prisma');
  expect(files['lib/notes-store.ts']).toContain(
    'eq(notes.userId, where.userId)'
  );
  expect(files['lib/schema.ts']).toContain('sqliteTable("session"');
  expect(files['lib/schema.ts']).toContain('sqliteTable("account"');
  expect(files['lib/auth.ts']).toContain("provider: 'sqlite'");
  expect(files['lib/auth.ts']).toContain('schema,');
});

test('PlanetScale Drizzle enables certificate verification in runtime and schema clients', () => {
  const files = buildTree(
    resolveStack({
      database: 'mysql',
      dbSetup: 'planetscale',
      orm: 'drizzle',
      auth: 'none',
    }),
    { projectName: 'hosted', packageManager: 'bun' }
  );
  expect(files['lib/db.ts']).toContain('ssl: { rejectUnauthorized: true }');
  expect(files['drizzle.config.ts']).toContain(
    'ssl: { rejectUnauthorized: true }'
  );
  expect(files['.env.example']).not.toContain('sslaccept');
});

test('Nest Drizzle emits Node ESM imports for its database and Notes repository', () => {
  const files = buildTree(
    resolveStack({
      backend: 'nest',
      database: 'sqlite',
      dbSetup: 'turso',
      orm: 'drizzle',
      auth: 'none',
      api: 'none',
    }),
    { projectName: 'hosted', packageManager: 'bun' }
  );
  expect(files['apps/server/src/db.ts']).toContain('from "./schema.js"');
  expect(files['apps/server/src/notes-store.ts']).toContain('from "./db.js"');
  expect(files['apps/server/src/notes-store.ts']).toContain(
    'from "./schema.js"'
  );
  expect(files['apps/server/src/notes.controller.ts']).toContain(
    'notes-store.js'
  );
});
