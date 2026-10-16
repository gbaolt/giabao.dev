import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const FAMILIES = ['shadcn', 'forms', 'login', 'next'];

async function readSources(root: string, prefix = '') {
  const sources: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(`Symlink in templates: ${path}`);
    if (entry.isDirectory()) {
      if (
        !/^(?:shadcn(?:\/(?:app|lib|components(?:\/ui)?))?|forms(?:\/(?:rhf|tanstack|notes))?|login(?:\/(?:forms|pages))?|next(?:\/app)?)$/.test(
          path
        )
      ) {
        throw new Error(`Unexpected template directory: ${path}`);
      }
      Object.assign(sources, await readSources(root, path));
    } else if (entry.isFile()) {
      sources[path] = (await readFile(join(root, path), 'utf8')).replaceAll(
        '\r\n',
        '\n'
      );
    } else {
      throw new Error(`Unsupported template entry: ${path}`);
    }
  }
  return sources;
}

async function templateAssets(root: string) {
  const templateRoot = join(root, 'templates');
  if ((await lstat(templateRoot)).isSymbolicLink()) {
    throw new Error('Symlink in templates: templates');
  }
  const entries = await readdir(templateRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'README.md' && entry.isFile()) continue;
    if (!FAMILIES.includes(entry.name) || !entry.isDirectory()) {
      throw new Error(`Unexpected template entry: ${entry.name}`);
    }
  }
  for (const family of FAMILIES) {
    if (!entries.some((entry) => entry.name === family)) {
      throw new Error(`Missing template family: ${family}`);
    }
  }
  const sources = await readSources(templateRoot);
  const shadcn: Record<string, string> = {};
  const forms: Record<'rhf' | 'tanstack' | 'notes', Record<string, string>> = {
    rhf: {},
    tanstack: {},
    notes: {},
  };
  const login: Record<'forms' | 'pages', Record<string, string>> = {
    forms: {},
    pages: {},
  };
  const next: Record<string, string> = {};
  for (const path of Object.keys(sources).sort()) {
    if (path === 'README.md') continue;
    const source = sources[path];
    if (/^shadcn\/.+\.(?:ts|tsx|css|json)$/.test(path)) {
      shadcn[path.slice('shadcn/'.length)] = source;
    } else if (/^forms\/(rhf|tanstack)\/[^/]+\.tsx$/.test(path)) {
      const [, group, name] = path.split('/');
      if (group === 'rhf' || group === 'tanstack') forms[group][name] = source;
    } else if (
      /^forms\/notes\/(react-hook-form|tanstack-form)\.tsx$/.test(path)
    ) {
      forms.notes[path.slice('forms/notes/'.length, -'.tsx'.length)] = source;
    } else if (
      /^login\/forms\/(none|react-hook-form|tanstack-form)\.tsx$/.test(path)
    ) {
      login.forms[path.slice('login/forms/'.length, -'.tsx'.length)] = source;
    } else if (/^login\/pages\/(next|tanstack-start)\.tsx$/.test(path)) {
      login.pages[path.slice('login/pages/'.length, -'.tsx'.length)] = source;
    } else if (/^next\/(?:[^/]+\.(?:ts|mjs)|app\/[^/]+\.css)$/.test(path)) {
      const name = path.slice('next/'.length);
      const output = name === 'next-env.template.d.ts' ? 'next-env.d.ts' : name;
      if (Object.hasOwn(next, output)) {
        throw new Error(`Duplicate template output: next/${output}`);
      }
      next[output] = source;
    } else {
      throw new Error(`Unexpected template path: ${path}`);
    }
  }
  return {
    'shadcn/formatted-source.json': shadcn,
    'forms/formatted-source.json': forms,
    'login/source.json': login,
    'next/source.json': next,
  };
}

export async function syncTemplates({
  root = PACKAGE_ROOT,
  check = false,
}: { root?: string; check?: boolean } = {}): Promise<void> {
  const assets = await templateAssets(root);
  const stale: string[] = [];
  for (const [path, asset] of Object.entries(assets)) {
    const target = join(root, 'src/generate/assets', path);
    const expected = JSON.stringify(asset, null, 2) + '\n';
    let current: string | undefined;
    try {
      current = (await readFile(target, 'utf8')).replaceAll('\r\n', '\n');
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
    if (current === expected) continue;
    if (check) {
      stale.push(path);
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, expected);
    }
  }
  if (stale.length) {
    throw new Error(
      `Generated template assets are stale: ${stale.join(', ')}. Run bun run --filter create-gb-app templates:generate.`
    );
  }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
      throw new Error('Usage: bun script/templates.ts [--check]');
    }
    await syncTemplates({ check: args[0] === '--check' });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
