import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');

type TemplateDirectory = {
  // Grouped files are keyed by filename under the directory name instead of by family-relative path.
  group?: boolean;
  stripExtension?: boolean;
};

type TemplateFamily = {
  asset: string;
  extensions: readonly string[];
  directories: Readonly<Record<string, TemplateDirectory>>;
  rename?: Readonly<Record<string, string>>;
};

const FAMILIES: Readonly<Record<string, TemplateFamily>> = {
  shadcn: {
    asset: 'shadcn/formatted-source.json',
    extensions: ['.css', '.json', '.ts', '.tsx'],
    directories: {
      '': {},
      app: {},
      lib: {},
      components: {},
      'components/ui': {},
    },
  },
  forms: {
    asset: 'forms/formatted-source.json',
    extensions: ['.tsx'],
    directories: {
      rhf: { group: true },
      tanstack: { group: true },
      notes: { group: true, stripExtension: true },
    },
  },
  login: {
    asset: 'login/source.json',
    extensions: ['.tsx'],
    directories: {
      forms: { group: true, stripExtension: true },
      pages: { group: true, stripExtension: true },
    },
  },
  next: {
    asset: 'next/source.json',
    extensions: ['.json', '.mjs', '.ts', '.tsx'],
    directories: { '': {}, app: {} },
    // The authored name avoids the repository's ignore rule for Next's generated declaration file.
    rename: { 'next-env.template.d.ts': 'next-env.d.ts' },
  },
};

async function readSources(root: string, prefix = '') {
  const sources: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(`Symlink in templates: ${path}`);
    if (entry.isDirectory()) {
      if (!isTemplateDirectory(path)) {
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

function splitFamily(path: string): [string, string] {
  const slash = path.indexOf('/');
  return slash === -1
    ? [path, '']
    : [path.slice(0, slash), path.slice(slash + 1)];
}

function isTemplateDirectory(path: string): boolean {
  const [name, directory] = splitFamily(path);
  const family = FAMILIES[name];
  if (!family || !directory) return Boolean(family);
  // A nested directory is valid when it is declared or is an ancestor of a declared one.
  return Object.keys(family.directories).some(
    (declared) => declared === directory || declared.startsWith(`${directory}/`)
  );
}

function assetEntry(path: string): {
  family: TemplateFamily;
  group?: string;
  key: string;
} {
  const [name, relative] = splitFamily(path);
  const family = FAMILIES[name];
  const slash = relative.lastIndexOf('/');
  const directory = slash === -1 ? '' : relative.slice(0, slash);
  const filename = relative.slice(slash + 1);
  const options =
    family && Object.hasOwn(family.directories, directory)
      ? family.directories[directory]
      : undefined;
  const extension = family?.extensions.find((candidate) =>
    filename.endsWith(candidate)
  );
  if (!family || !options || !extension || filename === extension) {
    throw new Error(`Unexpected template path: ${path}`);
  }
  const base = options.stripExtension
    ? filename.slice(0, -extension.length)
    : filename;
  if (options.group) return { family, group: directory, key: base };
  return { family, key: family.rename?.[relative] ?? relative };
}

async function templateAssets(root: string) {
  const templateRoot = join(root, 'templates');
  if ((await lstat(templateRoot)).isSymbolicLink()) {
    throw new Error('Symlink in templates: templates');
  }
  const entries = await readdir(templateRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'README.md' && entry.isFile()) continue;
    if (!Object.hasOwn(FAMILIES, entry.name) || !entry.isDirectory()) {
      throw new Error(`Unexpected template entry: ${entry.name}`);
    }
  }
  for (const family of Object.keys(FAMILIES)) {
    if (!entries.some((entry) => entry.name === family)) {
      throw new Error(`Missing template family: ${family}`);
    }
  }
  const sources = await readSources(templateRoot);
  const assets = new Map<TemplateFamily, Record<string, unknown>>();
  for (const family of Object.values(FAMILIES)) {
    const asset: Record<string, unknown> = {};
    for (const [directory, options] of Object.entries(family.directories)) {
      if (options.group) asset[directory] = {};
    }
    assets.set(family, asset);
  }
  for (const path of Object.keys(sources).sort()) {
    if (path === 'README.md') continue;
    const { family, group, key } = assetEntry(path);
    const asset = assets.get(family)!;
    const target = (group ? asset[group] : asset) as Record<string, string>;
    if (Object.hasOwn(target, key)) {
      throw new Error(`Duplicate template output: ${path}`);
    }
    target[key] = sources[path];
  }
  return Object.fromEntries(
    [...assets].map(([family, asset]) => [family.asset, asset])
  );
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
