import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Child = ReturnType<typeof Bun.spawn>;
type Options = {
  app: string;
  artifacts: string;
  environment: NodeJS.ProcessEnv;
  command: (task: string, args?: string[]) => string[];
  run: (
    name: string,
    command: string[],
    cwd?: string,
    expectedFailure?: boolean
  ) => Promise<void>;
  start: (
    command: string[],
    cwd: string,
    url: string,
    name: string,
    environment?: NodeJS.ProcessEnv
  ) => Promise<Child>;
  stop: (child: Child) => void;
  port: () => Promise<number>;
};

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return false;
    throw error;
  }
}
function descendants(pid: number): number[] {
  if (process.platform === 'win32') {
    const script =
      '$items = @(Get-CimInstance Win32_Process); $owned = @(' +
      pid +
      '); do { $next = @($items | Where-Object { $_.ParentProcessId -in $owned -and $_.ProcessId -notin $owned } | ForEach-Object ProcessId); $owned += $next } while ($next.Count -gt 0); ConvertTo-Json -Compress -InputObject @($owned)';
    const result = Bun.spawnSync([
      'powershell',
      '-NoProfile',
      '-Command',
      script,
    ]);
    if (result.exitCode !== 0)
      throw new Error('Could not enumerate the owned process tree');
    return JSON.parse(result.stdout.toString());
  }
  const result = Bun.spawnSync(['ps', '-eo', 'pid=,ppid=']);
  if (result.exitCode !== 0)
    throw new Error('Could not enumerate the owned process tree');
  const rows = result.stdout
    .toString()
    .trim()
    .split('\n')
    .map((row) => row.trim().split(/\s+/).map(Number));
  const owned = new Set([pid]);
  for (let previous = -1; previous !== owned.size;) {
    previous = owned.size;
    for (const [child, parent] of rows) if (owned.has(parent)) owned.add(child);
  }
  return Array.from(owned);
}
export async function verifyWorkspaceLifecycle(
  options: Options
): Promise<void> {
  const { app, artifacts, command, run } = options;
  const owners = ['packages/validation', 'apps/web', 'apps/server'];
  const originals = new Map(
    await Promise.all(
      owners.map(
        async (owner) =>
          [
            owner,
            await readFile(join(app, owner, 'package.json'), 'utf8'),
          ] as const
      )
    )
  );
  const restore = async () => {
    for (const [owner, source] of originals)
      await writeFile(join(app, owner, 'package.json'), source);
  };
  const patch = async (owner: string, task: string, script: string) => {
    const path = join(app, owner, 'package.json');
    const manifest: { scripts: Record<string, string> } = JSON.parse(
      await readFile(path, 'utf8')
    );
    manifest.scripts[task] = script;
    await writeFile(path, JSON.stringify(manifest, null, 2));
  };
  const closed = async (port: number) => {
    const listening = await fetch('http://127.0.0.1:' + port, {
      signal: AbortSignal.timeout(500),
    }).then(
      () => true,
      () => false
    );
    assert.equal(listening, false, 'Owned listener must stop');
  };
  let persistent: Child | undefined;
  try {
    await patch('packages/validation', 'build', 'node -e "process.exit(17)"');
    await patch(
      'apps/web',
      'dev',
      'node -e "console.log(\'APP_STARTED_BEFORE_DEPENDENCY\')"'
    );
    await run('dependency-failure', command('dev'), app, true);
    assert.equal(
      (
        await readFile(join(artifacts, 'dependency-failure.log'), 'utf8')
      ).includes('APP_STARTED_BEFORE_DEPENDENCY'),
      false
    );
    await restore();

    const port = await options.port();
    const pidFile = join(app, 'apps/server/lifecycle.pid');
    await writeFile(
      join(app, 'apps/server/lifecycle.mjs'),
      "import {createServer} from 'node:http'; import {writeFileSync} from 'node:fs'; createServer((req,res)=>res.end('fixture')).listen(" +
        port +
        ", '127.0.0.1', ()=>writeFileSync('lifecycle.pid',String(process.pid)));"
    );
    await patch('apps/server', 'dev', 'node lifecycle.mjs');
    await patch('apps/web', 'dev', 'node lifecycle.mjs');
    await writeFile(
      join(app, 'apps/web/lifecycle.mjs'),
      "import {existsSync} from 'node:fs'; const timeout=setTimeout(()=>process.exit(99),10000); const timer=setInterval(()=>{if(existsSync('../server/lifecycle.pid')){clearInterval(timer);clearTimeout(timeout);process.exit(19)}},25);"
    );
    await run('sibling-failure', command('dev'), app, true);
    const failedSiblingPid = Number(await readFile(pidFile, 'utf8'));
    assert.ok(
      failedSiblingPid > 0,
      'The sibling must have started before failure'
    );
    assert.equal(
      alive(failedSiblingPid),
      false,
      'Sibling process must not survive failure'
    );
    await closed(port);

    await writeFile(pidFile, '');
    await writeFile(
      join(app, 'apps/web/lifecycle.mjs'),
      'setInterval(()=>{},1000);'
    );
    const release = join(artifacts, 'interrupt-workspace');
    const preload = join(artifacts, 'interrupt-workspace.cjs');
    // Exercise the signal handler on Windows, where kill(SIGINT) force-terminates Node.
    await writeFile(
      preload,
      "if(process.argv[1]?.replaceAll('\\\\','/').endsWith('/scripts/workspace.mjs')){const fs=require('node:fs');const timer=setInterval(()=>{if(fs.existsSync(" +
        JSON.stringify(release) +
        ")){clearInterval(timer);process.emit('SIGINT')}},25);timer.unref()}"
    );
    const environment = {
      ...options.environment,
      NODE_OPTIONS:
        (options.environment.NODE_OPTIONS ?? '') +
        ' --require=' +
        JSON.stringify(preload),
    };
    persistent = await options.start(
      command('dev'),
      app,
      'http://127.0.0.1:' + port,
      'lifecycle-interruption',
      environment
    );
    const owned = descendants(persistent.pid);
    assert.ok(
      owned.length > 1,
      'Root command must own its application processes'
    );
    await writeFile(release, '');
    const child = persistent;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        options.stop(child);
        reject(new Error('Interrupted workspace did not terminate'));
      }, 10000);
    });
    let exitCode: number;
    try {
      exitCode = await Promise.race([child.exited, timeout]);
    } finally {
      clearTimeout(timer);
    }
    assert.equal(
      exitCode,
      130,
      'Root command must preserve its interruption status'
    );
    assert.deepEqual(
      owned.filter(alive),
      [],
      'No owned descendant may survive interruption'
    );
    await closed(port);
    await writeFile(
      join(artifacts, 'workspace-lifecycle.json'),
      JSON.stringify(
        {
          dependencyFailure: true,
          siblingFailure: true,
          signal: 'SIGINT',
          exitCode,
          owned,
          processesRemoved: true,
          portReleased: true,
          pathContainsSpaces: app.includes(' '),
        },
        null,
        2
      )
    );
  } finally {
    if (persistent) {
      options.stop(persistent);
      await persistent.exited;
    }
    await restore();
  }
}
