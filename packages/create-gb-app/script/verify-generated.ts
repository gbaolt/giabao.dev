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
  'start-orpc-rhf': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    linter: 'oxlint',
    form: 'react-hook-form',
  },
  'start-orpc-rhf-auth': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
    linter: 'oxlint',
    form: 'react-hook-form',
  },
  'start-orpc-tanstack-form': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    linter: 'oxlint',
    form: 'tanstack-form',
  },
  'start-orpc-tanstack-form-auth': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
    linter: 'oxlint',
    form: 'tanstack-form',
  },
  'start-orpc-workspace': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'none',
    linter: 'oxlint',
    structure: 'turborepo',
  },
  'start-orpc-workspace-auth': {
    frontend: 'tanstack-start',
    api: 'orpc',
    auth: 'better-auth',
    linter: 'oxlint',
    structure: 'turborepo',
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
const availablePort = () =>
  new Promise<number>((resolve, reject) => {
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
const port = await availablePort();
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
const stages: {
  name: string;
  command: string[];
  pid: number;
  exitCode: number | null;
}[] = [];
const evidence = {
  fixture: caseName,
  configuration: stack,
  platform: process.platform,
  runtime: Bun.version,
  nodeRuntime: Bun.spawnSync(['node', '--version']).stdout.toString().trim(),
  origin,
  databaseName,
  servers: [] as {
    name: string;
    command: string[];
    pid: number;
    cwd: string;
    url: string;
  }[],
  interruptedBy: undefined as NodeJS.Signals | undefined,
  stages,
};
const processes = new Set<ReturnType<typeof Bun.spawn>>();
const interruption = new AbortController();
const admin = new SQL(databaseRoot);
let databaseCreated = false;

function stop(child: ReturnType<typeof Bun.spawn>) {
  if (process.platform === 'win32') {
    if (child.exitCode !== null) return;
    Bun.spawnSync(['taskkill', '/pid', String(child.pid), '/t', '/f'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } else {
    try {
      // Each owned command has its own process group, including descendants.
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ESRCH'
      ))
        throw error;
    }
  }
}

function interrupt(signal: NodeJS.Signals) {
  evidence.interruptedBy = signal;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  interruption.abort(new Error(`Fixture interrupted by ${signal}`));
  for (const child of processes) stop(child);
}

const onInterrupt = () => interrupt('SIGINT');
const onTerminate = () => interrupt('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);

async function record() {
  await Bun.write(
    join(artifacts, 'result.json'),
    JSON.stringify(evidence, null, 2)
  );
}

async function run(name: string, command: string[], cwd = app) {
  interruption.signal.throwIfAborted();
  const log = Bun.file(join(artifacts, `${name}.log`));
  const child = Bun.spawn(command, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    stdout: log,
    stderr: Bun.file(join(artifacts, `${name}.stderr.log`)),
  });
  processes.add(child);
  const stage = {
    name,
    command,
    pid: child.pid,
    exitCode: null as number | null,
  };
  evidence.stages.push(stage);
  await record();
  const timeout = setTimeout(() => stop(child), 300_000);
  let exitCode: number;
  try {
    exitCode = await child.exited;
  } finally {
    clearTimeout(timeout);
    processes.delete(child);
  }
  stage.exitCode = exitCode;
  await record();
  interruption.signal.throwIfAborted();
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit ${exitCode}. See ${log.name}`);
  }
  console.log(`${caseName}: ${name} passed`);
}

async function start(
  command: string[],
  cwd: string,
  url: string,
  name: string,
  environment = env
) {
  interruption.signal.throwIfAborted();
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
    env: environment,
    detached: process.platform !== 'win32',
    stdout: log,
    stderr: Bun.file(join(artifacts, `${name}.stderr.log`)),
  });
  processes.add(child);
  evidence.servers.push({ name, command, pid: child.pid, cwd, url });
  await record();
  for (let attempt = 0; attempt < 120; attempt++) {
    interruption.signal.throwIfAborted();
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
  interruption.signal.throwIfAborted();
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  interruption.signal.throwIfAborted();
  await run('install', ['bun', 'install']);
  const databaseCommandRoot = stack.backend === 'nest' ? server : app;
  await run(
    'database-client',
    ['bun', 'run', 'db:generate'],
    databaseCommandRoot
  );
  await run('database-schema', ['bun', 'run', 'db:push'], databaseCommandRoot);
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
  if (
    workspace &&
    stack.backend === 'self' &&
    stack.frontend === 'tanstack-start' &&
    stack.api === 'orpc'
  ) {
    const devPort = await availablePort();
    const devOrigin = `http://127.0.0.1:${devPort}`;
    await start(
      [
        'bun',
        'run',
        'dev',
        '--filter=web',
        '--',
        '--port',
        String(devPort),
        '--host',
        '127.0.0.1',
      ],
      app,
      devOrigin,
      'root-dev',
      { ...env, PORT: String(devPort), BETTER_AUTH_URL: devOrigin }
    );
    await run('root-dev-http-notes', [
      'bun',
      join(dirname(fileURLToPath(import.meta.url)), 'verify-notes.mjs'),
      web,
      devOrigin,
      devOrigin,
      stack.backend,
      stack.api,
      stack.auth,
      stack.frontend,
      'dev',
    ]);
  }
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
    ) {
      interruption.signal.throwIfAborted();
      await Bun.sleep(1000);
    }
  }
} catch (error) {
  if (!interruption.signal.aborted) throw error;
} finally {
  try {
    for (const child of Array.from(processes).reverse()) {
      stop(child);
      await child.exited;
    }
  } finally {
    try {
      if (databaseCreated)
        await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } finally {
      await admin.close();
      await record();
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
      console.log(`Fixture retained for inspection: ${root}`);
    }
  }
}
