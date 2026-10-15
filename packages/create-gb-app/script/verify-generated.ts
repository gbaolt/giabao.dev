import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SQL } from 'bun';

import { buildTree, resolveStack } from '../src/generate/public';
import { writeTree } from '../src/generate/write-tree';
import type { RawFlags } from '../src/types/stack';

const cases = {
  next: { yes: true },
  'start-trpc': {
    frontend: 'tanstack-start',
    api: 'trpc',
    auth: 'none',
    linter: 'oxlint',
  },
  nest: { frontend: 'tanstack-start', backend: 'nest' },
  'start-orpc': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    linter: 'oxlint',
  },
  'start-orpc-eslint': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    linter: 'eslint',
  },
  'start-orpc-auth': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
    linter: 'oxlint',
  },
} satisfies Record<string, RawFlags>;

const caseName = process.argv[2];
if (!caseName || !(caseName in cases)) {
  throw new Error(`Choose a fixture: ${Object.keys(cases).join(', ')}`);
}
const selected = Object.entries(cases).find(([name]) => name === caseName);
if (!selected) throw new Error('Missing fixture');
const databaseRoot = process.env.FIXTURE_DATABASE_URL;
if (!databaseRoot) {
  throw new Error(
    'FIXTURE_DATABASE_URL must name a disposable PostgreSQL cluster with CREATE DATABASE permission'
  );
}
const root = await mkdtemp(join(tmpdir(), `create-gb-${caseName}-`));
const app = join(root, 'app');
const artifacts = join(root, 'evidence');
await mkdir(artifacts);
const databaseName = `gb_fixture_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = new URL(databaseRoot);
databaseUrl.pathname = `/${databaseName}`;
const port = await new Promise<number>((resolve, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const address = listener.address();
    if (!address || typeof address === 'string') {
      listener.close();
      reject(new Error('Could not allocate fixture port'));
      return;
    }
    listener.close(() => resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const stack = resolveStack(selected[1]);
if (stack.backend === 'convex')
  throw new Error('This fixture requires SQL persistence');
const workspace = stack.structure !== 'single';
const web = workspace ? join(app, 'apps/web') : app;
const server = stack.backend === 'nest' ? join(app, 'apps/server') : web;
const authOrigin = stack.backend === 'nest' ? 'http://localhost:3333' : origin;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  BETTER_AUTH_URL: authOrigin,
  BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
  NEXT_TELEMETRY_DISABLED: '1',
  VITE_SERVER_URL: authOrigin,
  PORT: String(port),
  HOST: '127.0.0.1',
};
const stages: { name: string; command: string[]; exitCode: number }[] = [];
const evidence = {
  fixture: caseName,
  configuration: stack,
  platform: process.platform,
  runtime: Bun.version,
  origin,
  stages,
};
const processes: ReturnType<typeof Bun.spawn>[] = [];
const admin = new SQL(databaseRoot);
let databaseCreated = false;

function stop(child: ReturnType<typeof Bun.spawn>) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    Bun.spawnSync(['taskkill', '/pid', String(child.pid), '/t', '/f'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } else {
    child.kill();
  }
}

async function record() {
  await Bun.write(
    join(artifacts, 'result.json'),
    JSON.stringify(evidence, null, 2)
  );
}

async function run(name: string, command: string[], cwd = app) {
  const log = Bun.file(join(artifacts, `${name}.log`));
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdout: log,
    stderr: Bun.file(join(artifacts, `${name}.stderr.log`)),
  });
  const timeout = setTimeout(() => stop(child), 300_000);
  const exitCode = await child.exited;
  clearTimeout(timeout);
  evidence.stages.push({ name, command, exitCode });
  await record();
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit ${exitCode}. See ${log.name}`);
  }
  console.log(`${caseName}: ${name} passed`);
}

async function start(
  command: string[],
  cwd: string,
  url: string,
  name: string
) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(500) });
    throw new Error(`Fixture origin already has a listener: ${url}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Fixture origin'))
      throw error;
  }
  const log = Bun.file(join(artifacts, `${name}.log`));
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdout: log,
    stderr: Bun.file(join(artifacts, `${name}.stderr.log`)),
  });
  processes.push(child);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`${name} exited. See ${log.name}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* The owned server may still be starting. */
    }
    await Bun.sleep(500);
  }
  throw new Error(`${name} did not become ready. See ${log.name}`);
}

try {
  const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: dirname(fileURLToPath(import.meta.url)),
  });
  await Bun.write(join(artifacts, 'revision.txt'), revision.stdout);
  await writeTree(
    app,
    buildTree(stack, { projectName: 'fixture-app', packageManager: 'bun' })
  );
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  await run('install', ['bun', 'install']);
  await run('database-client', ['bun', 'run', 'db:generate'], server);
  await run('database-schema', ['bun', 'run', 'db:push'], server);
  await run('build', ['bun', 'run', 'build']);
  await run('typecheck', ['bun', 'x', '--no-install', 'tsc', '--noEmit'], web);
  if (stack.backend === 'nest') {
    await start(
      ['node', 'dist/main.js'],
      server,
      `${authOrigin}/api/auth/ok`,
      'server'
    );
  }
  await start(
    [
      'bun',
      'run',
      'start',
      '--port',
      String(port),
      '--host',
      '127.0.0.1',
    ].filter((_, index) => stack.frontend !== 'next' || index < 5),
    web,
    origin,
    'web'
  );
  await run('http-notes', [
    'bun',
    join(dirname(fileURLToPath(import.meta.url)), 'verify-notes.mjs'),
    web,
    origin,
    authOrigin,
    stack.backend,
    stack.api,
    stack.auth,
    stack.frontend,
  ]);
  await run('lint', ['bun', 'run', 'lint'], web);
  if (
    stack.backend === 'self' &&
    stack.frontend === 'tanstack-start' &&
    stack.api === 'orpc'
  ) {
    await run('browser', [
      'bun',
      join(dirname(fileURLToPath(import.meta.url)), 'verify-browser.ts'),
      origin,
      artifacts,
      stack.auth,
    ]);
  }
  await run('resolved-dependencies', ['bun', 'pm', 'ls', '--all']);
  await Bun.write(
    join(artifacts, 'bun.lock'),
    await readFile(join(app, 'bun.lock'))
  );
  console.log(`Verification evidence: ${artifacts}`);
  if (process.argv.includes('--hold')) {
    console.log(
      `Browser verification ready: ${origin}. Create ${join(artifacts, 'release')} to stop.`
    );
    for (
      let attempt = 0;
      attempt < 900 && !(await Bun.file(join(artifacts, 'release')).exists());
      attempt++
    )
      await Bun.sleep(1000);
  }
} finally {
  for (const child of processes.reverse()) {
    stop(child);
    await child.exited;
  }
  await record();
  if (databaseCreated)
    await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.close();
  console.log(`Fixture retained for inspection: ${root}`);
}
