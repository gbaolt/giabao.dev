import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SQL } from 'bun';

import {
  buildTree,
  isPackageManager,
  parseChoice,
  resolveStack,
} from '../src/generate/public';
import { writeTree } from '../src/generate/write-tree';
import type { RawFlags } from '../src/types/stack';
import { verifyTurboCache } from './verify-turbo-cache';
import { verifyWorkspaceLifecycle } from './verify-workspace-lifecycle';

const cases = {
  'hono-shell': {
    backend: 'hono',
    database: 'none',
    auth: 'none',
    api: 'none',
    addons: { linting: 'oxlint' },
  },
  'nest-shell': {
    backend: 'nest',
    database: 'none',
    auth: 'none',
    api: 'none',
    addons: { linting: 'oxlint' },
  },
  'next-shell-workspace': {
    database: 'none',
    auth: 'none',
    api: 'none',
    structure: 'monorepo',
    addons: { linting: 'oxlint' },
  },
  'start-shell-workspace': {
    frontend: 'tanstack-start',
    database: 'none',
    auth: 'none',
    api: 'none',
    structure: 'monorepo',
    addons: { linting: 'oxlint' },
  },
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
if (
  process.argv.includes('--hold') &&
  (process.argv.includes('--cache') || process.argv.includes('--lifecycle'))
)
  throw new Error(
    '--hold cannot be combined with disposable cache/lifecycle mutation phases'
  );
if (!caseName || !(caseName in cases)) {
  throw new Error(`Choose a fixture: ${Object.keys(cases).join(', ')}`);
}
const selected = Object.entries(cases).find(([name]) => name === caseName);
if (!selected) throw new Error('Missing fixture');
const managerOption =
  process.argv.find((arg) => arg.startsWith('--manager='))?.slice(10) ?? 'bun';
if (!isPackageManager(managerOption))
  throw new Error('Unsupported fixture package manager');
const packageManager = managerOption;
const managerPrefix = process.argv.includes('--corepack')
  ? ['corepack', packageManager]
  : [packageManager];
const rawRunner = process.argv
  .find((arg) => arg.startsWith('--runner='))
  ?.slice(9);
const runnerOption =
  rawRunner === undefined
    ? undefined
    : parseChoice('runner', rawRunner, ['none', 'turborepo'] as const);
const rawFrontend = process.argv
  .find((arg) => arg.startsWith('--frontend='))
  ?.slice(11);
const frontendOption =
  rawFrontend === undefined
    ? undefined
    : parseChoice('frontend', rawFrontend, ['next', 'tanstack-start'] as const);
const selectedFlags: RawFlags = {
  ...selected[1],
  ...(frontendOption ? { frontend: frontendOption } : {}),
  addons: {
    ...('addons' in selected[1] ? selected[1].addons : {}),
    ...(runnerOption ? { taskRunner: runnerOption } : {}),
  },
};
const stack = resolveStack(selectedFlags);
if (stack.backend === 'convex')
  throw new Error('This fixture requires a local application');
const needsDatabase = stack.database !== 'none';
const databaseRoot = process.env.FIXTURE_DATABASE_URL;
if (needsDatabase && !databaseRoot)
  throw new Error(
    'FIXTURE_DATABASE_URL must name a disposable PostgreSQL cluster with CREATE DATABASE permission'
  );
const managerRun = (task: string, args: string[] = []) => [
  ...managerPrefix,
  'run',
  task,
  ...(packageManager === 'npm' && args.length ? ['--'] : []),
  ...args,
];
const root = await mkdtemp(join(tmpdir(), `create-gb-${caseName}-`));
const app = join(
  root,
  process.argv.includes('--spaces') ? 'app with spaces' : 'app'
);
const artifacts = join(root, 'evidence');
await mkdir(artifacts);
const databaseName = `gb_fixture_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = new URL(
  databaseRoot ?? 'postgres://postgres@127.0.0.1/postgres'
);
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
const workspace = stack.structure !== 'single';
const separate = stack.backend === 'nest' || stack.backend === 'hono';
const web = workspace ? join(app, 'apps/web') : app;
const server = separate ? join(app, 'apps/server') : web;
const serverPort = separate ? await availablePort() : port;
const authOrigin = separate ? 'http://127.0.0.1:' + serverPort : origin;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  BETTER_AUTH_URL: authOrigin,
  BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
  NEXT_TELEMETRY_DISABLED: '1',
  VITE_SERVER_URL: authOrigin,
  PORT: String(port),
  SERVER_PORT: String(serverPort),
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
  packageManager,
  runner: stack.addons.taskRunner,
  environmentSource: process.argv.includes('--local-env')
    ? 'server-local-file'
    : 'process',
  checksPassed: false,
  nodeRuntime: Bun.spawnSync(['node', '--version']).stdout.toString().trim(),
  origin,
  databaseName,
  servers: [] as {
    name: string;
    command: string[];
    pid: number;
    cwd: string;
    url: string;
    ready: boolean;
  }[],
  backendChecks: [] as { stage: string; status: number }[],
  generatedFilesSha256: '',
  portsReleased: false,
  interruptedBy: undefined as NodeJS.Signals | undefined,
  stages,
};
const processes = new Set<ReturnType<typeof Bun.spawn>>();
const interruption = new AbortController();
const admin = needsDatabase && databaseRoot ? new SQL(databaseRoot) : null;
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

async function run(
  name: string,
  command: string[],
  cwd = app,
  expectedFailure = false
) {
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
    expectedFailure,
  };
  evidence.stages.push(stage);
  await record();
  const timeout = setTimeout(
    () => stop(child),
    name === 'install' ? 600_000 : 300_000
  );
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
  if ((exitCode === 0) === expectedFailure) {
    throw new Error(`${name} failed with exit ${exitCode}. See ${log.name}`);
  }
  console.log(`${caseName}: ${name} passed`);
}

async function start(
  command: string[],
  cwd: string,
  url: string,
  name: string,
  environment: NodeJS.ProcessEnv = env
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
  const serverEvidence = {
    name,
    command,
    pid: child.pid,
    cwd,
    url,
    ready: false,
  };
  evidence.servers.push(serverEvidence);
  await record();
  for (let attempt = 0; attempt < 120; attempt++) {
    interruption.signal.throwIfAborted();
    if (child.exitCode !== null)
      throw new Error(`${name} exited. See ${log.name}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        serverEvidence.ready = true;
        await record();
        return child;
      }
    } catch {
      /* The owned server may still be starting. */
    }
    await Bun.sleep(500);
  }
  throw new Error(`${name} did not become ready. See ${log.name}`);
}

async function verifyBackend(stage: string) {
  if (!separate) return;
  for (let attempt = 0; attempt < 120; attempt++) {
    interruption.signal.throwIfAborted();
    try {
      const response = await fetch(authOrigin, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status < 500) {
        evidence.backendChecks.push({ stage, status: response.status });
        await record();
        return;
      }
    } catch {
      /* The separate application can start after the frontend. */
    }
    await Bun.sleep(250);
  }
  throw new Error('Separate application did not become ready during ' + stage);
}

try {
  const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: dirname(fileURLToPath(import.meta.url)),
  });
  await Bun.write(join(artifacts, 'revision.txt'), revision.stdout);
  const files = buildTree(stack, {
    projectName: 'fixture-app',
    packageManager,
  });
  evidence.generatedFilesSha256 = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(files))
    .digest('hex');
  await writeTree(app, files);
  if (process.argv.includes('--local-env')) {
    if (!separate || !needsDatabase)
      throw new Error(
        'Local environment verification requires a separate relational backend'
      );
    const path = join(server, '.env');
    let source = await readFile(path, 'utf8');
    for (const name of [
      'DATABASE_URL',
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
    ]) {
      const value = env[name];
      if (value === undefined) continue;
      source = source.replace(
        new RegExp('^' + name + '=.*$', 'm'),
        name + '=' + JSON.stringify(value)
      );
      delete env[name];
    }
    await Bun.write(path, source);
  }
  interruption.signal.throwIfAborted();
  if (admin) {
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
  }
  interruption.signal.throwIfAborted();
  await run('manager-version', [...managerPrefix, '--version']);
  await run('install', [...managerPrefix, 'install']);
  if (needsDatabase) {
    const databaseCommandRoot = workspace ? app : server;
    await run(
      'database-client',
      managerRun('db:generate'),
      databaseCommandRoot
    );
    await run('database-schema', managerRun('db:push'), databaseCommandRoot);
  }
  await run('build', managerRun('build'));
  if (workspace)
    await run(
      'workspace-import',
      [
        'node',
        '--input-type=module',
        '-e',
        "import { noteInputSchema } from '@repo/validation'; if (noteInputSchema.safeParse({title: '', body: ''}).success) process.exit(1);",
      ],
      web
    );
  await run(
    'typecheck',
    workspace
      ? managerRun('typecheck')
      : ['bun', 'x', '--no-install', 'tsc', '--noEmit'],
    workspace ? app : web
  );
  const webArgs = [
    '--port',
    String(port),
    ...(stack.frontend === 'next' ? [] : ['--host', '127.0.0.1']),
  ];
  if (workspace) {
    await start(managerRun('start'), app, origin, 'root-start');
  } else {
    await start(managerRun('start', webArgs), web, origin, 'web');
  }
  await verifyBackend('root-start');
  if (needsDatabase) {
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
  }
  await run('lint', managerRun('lint'), workspace ? app : web);
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
  if (packageManager === 'bun')
    await run('resolved-dependencies', ['bun', 'pm', 'ls', '--all']);
  if (workspace) {
    {
      const production = evidence.servers.find(
        (entry) => entry.name === 'root-start'
      );
      const child = Array.from(processes).find(
        (entry) => entry.pid === production?.pid
      );
      if (!child) throw new Error('Missing owned production workspace process');
      stop(child);
      await child.exited;
      processes.delete(child);
      const stillListening = await fetch(origin, {
        signal: AbortSignal.timeout(1000),
      }).then(
        () => true,
        () => false
      );
      if (stillListening)
        throw new Error(
          'Root start left an application listening after shutdown'
        );
    }
    const devPort = await availablePort();
    const devOrigin = `http://127.0.0.1:${devPort}`;
    await start(managerRun('dev'), app, devOrigin, 'root-dev', {
      ...env,
      PORT: String(devPort),
      BETTER_AUTH_URL: separate ? authOrigin : devOrigin,
    });
    await verifyBackend('root-dev');
    if (needsDatabase && !separate)
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
  const lockfile = {
    bun: 'bun.lock',
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml',
    yarn: 'yarn.lock',
  }[packageManager];
  if (process.argv.includes('--cache')) {
    if (
      !workspace ||
      stack.frontend !== 'next' ||
      stack.addons.taskRunner !== 'turborepo'
    )
      throw new Error('Cache verification requires a Next Turbo workspace');
    for (const child of processes) {
      stop(child);
      await child.exited;
    }
    processes.clear();
    await verifyTurboCache({
      app,
      artifacts,
      environment: env,
      command: managerRun,
      run,
    });
  }
  if (process.argv.includes('--lifecycle')) {
    if (!workspace || !separate || stack.addons.taskRunner !== 'none')
      throw new Error(
        'Lifecycle verification requires a plain separate-backend workspace'
      );
    for (const child of processes) {
      stop(child);
      await child.exited;
    }
    processes.clear();
    await verifyWorkspaceLifecycle({
      app,
      artifacts,
      environment: env,
      command: managerRun,
      run,
      start,
      stop,
      port: availablePort,
    });
  }
  await Bun.write(
    join(artifacts, lockfile),
    await readFile(join(app, lockfile))
  );
  evidence.checksPassed = true;
  await record();
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
    const urls = new Set([
      ...evidence.servers.map((entry) => entry.url),
      ...(separate ? [authOrigin] : []),
    ]);
    const listening = await Promise.all(
      Array.from(
        urls,
        async (url) =>
          await fetch(url, { signal: AbortSignal.timeout(500) }).then(
            () => url,
            () => null
          )
      )
    );
    evidence.portsReleased = listening.every((url) => url === null);
    if (!evidence.portsReleased)
      throw new Error('Fixture cleanup left an application listening');
  } finally {
    try {
      if (databaseCreated && admin)
        await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } finally {
      await admin?.close();
      await record();
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
      console.log(`Fixture retained for inspection: ${root}`);
    }
  }
}
