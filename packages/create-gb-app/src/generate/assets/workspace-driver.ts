export const WORKSPACE_DRIVER = String.raw`
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(readFileSync(join(root, 'scripts/workspaces.json'), 'utf8'));
const [task, ...arguments_] = process.argv.slice(2);
const args = arguments_.filter((value) => value !== '--');
// Yarn exposes a shell shim as npm_execpath; Corepack provides its portable JS entry.
const corepack = process.env.COREPACK_ROOT && join(process.env.COREPACK_ROOT, 'dist', config.manager + '.js');
const cli = corepack && existsSync(corepack) ? corepack : process.env.npm_execpath;
if (!cli) throw new Error('Run this task with ' + config.manager + ' run ' + task);
const children = new Set();
let interrupted = false;

function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
function interrupt(code) {
  interrupted = true;
  process.exitCode = code;
  for (const child of children) stop(child);
}
process.once('SIGINT', () => interrupt(130));
process.once('SIGTERM', () => interrupt(143));

function environment(dir) {
  let local = {};
  for (const name of ['.env', '.env.local']) {
    try { local = { ...local, ...parseEnv(readFileSync(join(dir, name), 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { ...local, ...process.env };
}
function run(workspace, action, forwarded = []) {
  if (interrupted) throw new Error('Workspace task interrupted');
  const cwd = join(root, workspace.dir);
  const prefix = /\.[cm]?js$/i.test(cli) ? [process.execPath, cli] : [cli];
  const command = [...prefix, 'run', action, ...(config.manager === 'npm' ? ['--'] : []), ...forwarded];
  const child = spawn(command[0], command.slice(1), {
    cwd, env: environment(cwd), stdio: 'inherit', detached: process.platform !== 'win32', windowsHide: true,
  });
  children.add(child);
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      children.delete(child);
      if (code === 0 || interrupted) resolve(code ?? 1);
      else reject(new Error(workspace.name + ' ' + action + ' failed with exit ' + code));
    });
  });
  return { child, exited };
}
async function sequential(workspaces, action, forwarded = []) {
  for (const workspace of workspaces) await run(workspace, action, forwarded).exited;
}
const packages = config.workspaces;
const shared = packages.filter((workspace) => workspace.dir.startsWith('packages/'));
try {
  const targets = packages.filter((workspace) => workspace.tasks.includes(task));
  if (!targets.length) throw new Error('No workspace implements ' + task);
  if (task === 'build') {
    for (const workspace of targets) await run(workspace, task, workspace.name === 'web' ? args : []).exited;
  } else if (task === 'typecheck') {
    await sequential(shared.filter((workspace) => workspace.tasks.includes('build')), 'build');
    for (const workspace of targets) {
      if (workspace.routeTree && !existsSync(join(root, workspace.dir, workspace.routeTree))) await run(workspace, 'build').exited;
    }
    await sequential(targets, task, args);
  } else if (task === 'dev' || task === 'start' || task === 'convex:dev') {
    await sequential(shared.filter((workspace) => workspace.tasks.includes('build')), 'build');
    const running = targets.map((workspace) => run(workspace, task, workspace.name === 'web' ? args : []));
    const firstExit = await Promise.race(running.map((entry) => entry.exited));
    if (!interrupted) {
      process.exitCode = firstExit || 1;
      console.error('A persistent workspace task exited; stopping its siblings.');
    }
    for (const entry of running) stop(entry.child);
    await Promise.allSettled(running.map((entry) => entry.exited));
  } else {
    await sequential(targets, task, args);
  }
} catch (error) {
  if (!interrupted) { console.error(error.message); process.exitCode = 1; }
} finally {
  for (const child of children) stop(child);
}

`;
