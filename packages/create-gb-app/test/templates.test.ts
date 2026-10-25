import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';

import { syncTemplates } from '../script/templates';

async function withTemplates(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'cga-templates-'));
  try {
    for (const [path, source] of Object.entries({
      'README.md': '# Templates\n',
      'shadcn/components/ui/button.tsx': 'export const Button = () => null;\n',
      'forms/rhf/form-input.tsx': 'export const Input = () => null;\n',
      'forms/tanstack/hooks.tsx': 'export const hooks = {};\n',
      'forms/notes/react-hook-form.tsx': 'export const Notes = () => null;\n',
      'login/forms/none.tsx': "const prefix = '__UI_PREFIX__';\n",
      'login/pages/next.tsx': 'const name = __PROJECT_NAME__;\n',
      'next/next-env.template.d.ts': '/// <reference types="next" />\n',
      'styles/globals.css': '@import "tailwindcss";\n',
    })) {
      const target = join(root, 'templates', path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('template generation preserves source text and existing asset shapes', async () => {
  await withTemplates(async (root) => {
    const source =
      'const text = `quotes " \' \\ ${expression} Tiếng Việt`;\r\n\r\n';
    await writeFile(join(root, 'templates/shadcn/lib.ts'), source);
    await syncTemplates({ root });
    const asset = async (path: string) =>
      JSON.parse(
        await readFile(join(root, 'src/generate/assets', path), 'utf8')
      );
    expect(await asset('shadcn/formatted-source.json')).toEqual({
      'components/ui/button.tsx': 'export const Button = () => null;\n',
      'lib.ts': source.replaceAll('\r\n', '\n'),
    });
    expect(await asset('forms/formatted-source.json')).toEqual({
      rhf: { 'form-input.tsx': 'export const Input = () => null;\n' },
      tanstack: { 'hooks.tsx': 'export const hooks = {};\n' },
      notes: { 'react-hook-form': 'export const Notes = () => null;\n' },
    });
    expect(await asset('login/source.json')).toEqual({
      forms: { none: "const prefix = '__UI_PREFIX__';\n" },
      pages: { next: 'const name = __PROJECT_NAME__;\n' },
    });
    expect(await asset('next/source.json')).toEqual({
      'next-env.d.ts': '/// <reference types="next" />\n',
    });
    expect(await asset('styles/source.json')).toEqual({
      'globals.css': '@import "tailwindcss";\n',
    });
  });
});

test('unexpected template directories fail before assets are written', async () => {
  await withTemplates(async (root) => {
    await mkdir(join(root, 'templates/forms/typo'));
    await expect(syncTemplates({ root })).rejects.toThrow(
      'Unexpected template'
    );
    expect(
      await Bun.file(
        join(root, 'src/generate/assets/login/source.json')
      ).exists()
    ).toBe(false);
  });
});

test('declaration aliases cannot overwrite another Next template', async () => {
  await withTemplates(async (root) => {
    await writeFile(
      join(root, 'templates/next/next-env.d.ts'),
      'other declaration\n'
    );
    await expect(syncTemplates({ root })).rejects.toThrow(
      'Duplicate template output'
    );
  });
});

const assetPaths = [
  'shadcn/formatted-source.json',
  'forms/formatted-source.json',
  'login/source.json',
  'next/source.json',
  'styles/source.json',
];

async function assetState(root: string) {
  const state: Record<string, { source: string; modified: number }> = {};
  for (const path of assetPaths) {
    const target = join(root, 'src/generate/assets', path);
    state[path] = {
      source: await readFile(target, 'utf8'),
      modified: (await stat(target)).mtimeMs,
    };
  }
  return state;
}

test('freshness checking and repeat generation leave assets untouched', async () => {
  await withTemplates(async (root) => {
    await syncTemplates({ root });
    for (const path of assetPaths) {
      const date = new Date('2001-01-01T00:00:00Z');
      await utimes(join(root, 'src/generate/assets', path), date, date);
    }
    const before = await assetState(root);
    await syncTemplates({ root, check: true });
    await syncTemplates({ root });
    expect(await assetState(root)).toEqual(before);

    await writeFile(
      join(root, 'templates/login/forms/none.tsx'),
      'changed source\n'
    );
    await expect(syncTemplates({ root, check: true })).rejects.toThrow(
      'login/source.json'
    );
    expect(await assetState(root)).toEqual(before);
    await syncTemplates({ root });
    await syncTemplates({ root, check: true });
    expect((await assetState(root))['login/source.json'].source).toContain(
      'changed source'
    );
  });
});

test('missing generated assets are reported without recreating them', async () => {
  await withTemplates(async (root) => {
    await syncTemplates({ root });
    const target = join(root, 'src/generate/assets/next/source.json');
    await unlink(target);
    await expect(syncTemplates({ root, check: true })).rejects.toThrow(
      'next/source.json'
    );
    expect(await Bun.file(target).exists()).toBe(false);
  });
});

test('Windows checkout line endings do not make committed JSON stale', async () => {
  await withTemplates(async (root) => {
    await syncTemplates({ root });
    for (const path of assetPaths) {
      const target = join(root, 'src/generate/assets', path);
      const source = await readFile(target, 'utf8');
      await writeFile(target, source.replaceAll('\n', '\r\n'));
    }
    const before = await assetState(root);
    await syncTemplates({ root, check: true });
    await syncTemplates({ root });
    expect(await assetState(root)).toEqual(before);
  });
});

test('adding and removing templates changes assets in sorted key order', async () => {
  await withTemplates(async (root) => {
    const added = join(root, 'templates/shadcn/z.ts');
    await writeFile(added, 'export const z = 1;');
    await writeFile(
      join(root, 'templates/shadcn/a.ts'),
      'export const a = 1;\n'
    );
    await syncTemplates({ root });
    const target = join(
      root,
      'src/generate/assets/shadcn/formatted-source.json'
    );
    const source = await readFile(target, 'utf8');
    expect(Object.keys(JSON.parse(source))).toEqual([
      'a.ts',
      'components/ui/button.tsx',
      'z.ts',
    ]);
    expect(JSON.parse(source)['z.ts']).toBe('export const z = 1;');
    await unlink(added);
    await expect(syncTemplates({ root, check: true })).rejects.toThrow(
      'shadcn/formatted-source.json'
    );
    await syncTemplates({ root });
    expect(JSON.parse(await readFile(target, 'utf8'))['z.ts']).toBeUndefined();
  });
});

test('unexpected files, missing families and linked directories are rejected', async () => {
  await withTemplates(async (root) => {
    const unexpected = join(root, 'templates/next/notes.txt');
    await writeFile(unexpected, 'unrecognized file\n');
    await expect(syncTemplates({ root })).rejects.toThrow(
      'Unexpected template path'
    );
    await unlink(unexpected);
    await symlink(
      join(root, 'templates/forms'),
      join(root, 'templates/shadcn/linked'),
      'junction'
    );
    await expect(syncTemplates({ root })).rejects.toThrow(
      'Symlink in templates'
    );
    await unlink(join(root, 'templates/shadcn/linked'));
    await rm(join(root, 'templates/next'), { recursive: true });
    await expect(syncTemplates({ root })).rejects.toThrow(
      'Missing template family: next'
    );
  });
});

test('template CLI resolves its package from another cwd and rejects unknown arguments', async () => {
  await withTemplates(async (root) => {
    await mkdir(join(root, 'script'));
    const entry = join(root, 'script/templates.ts');
    await copyFile(join(import.meta.dir, '../script/templates.ts'), entry);
    const run = async (...args: string[]) => {
      const child = Bun.spawn([process.execPath, entry, ...args], {
        cwd: tmpdir(),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stderr = await new Response(child.stderr).text();
      return { code: await child.exited, stderr };
    };
    expect((await run('--check')).code).toBe(1);
    expect(await run()).toEqual({ code: 0, stderr: '' });
    expect(await run('--check')).toEqual({ code: 0, stderr: '' });
    for (const args of [['--write'], ['--check', '--check']]) {
      expect(await run(...args)).toEqual({
        code: 1,
        stderr: 'Usage: bun script/templates.ts [--check]\n',
      });
    }
  });
});
