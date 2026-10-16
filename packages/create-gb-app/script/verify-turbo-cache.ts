import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function verifyTurboCache(options: {
  app: string;
  artifacts: string;
  environment: NodeJS.ProcessEnv;
  command: (task: string, args?: string[]) => string[];
  run: (name: string, command: string[]) => Promise<void>;
}) {
  const { app, artifacts, environment, command, run } = options;
  const shared = join(app, 'packages/validation/src/index.ts');
  const page = join(app, 'apps/web/app/page.tsx');
  const localEnv = join(app, 'apps/web/.env.local');
  const originalShared = await readFile(shared, 'utf8');
  const originalPage = await readFile(page, 'utf8');
  const originalEnv = (await Bun.file(localEnv).exists())
    ? await readFile(localEnv, 'utf8')
    : undefined;
  const originalValue = environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY;
  const output = join(app, 'packages/validation/dist/index.js');
  const html = join(app, 'apps/web/.next/server/app/index.html');
  const build = (name: string) => run(name, command('build'));
  const logs = async (name: string) =>
    (await readFile(join(artifacts, name + '.log'), 'utf8')) +
    (await readFile(join(artifacts, name + '.stderr.log'), 'utf8'));
  const miss = async (name: string, workspace: string) =>
    assert.match(
      await logs(name),
      new RegExp(workspace + ':build: cache miss')
    );
  try {
    // This phase mutates only the disposable fixture, after its unmodified smoke checks.
    await Bun.write(
      shared,
      originalShared + '\nexport const fixtureCacheValue = "shared-one";\n'
    );
    await Bun.write(
      page,
      'import { fixtureCacheValue } from "@repo/validation";\n' +
        originalPage.replace(
          '<main ',
          '<main data-cache-probe={process.env.NEXT_PUBLIC_FIXTURE_CACHE_KEY} data-domain-probe={fixtureCacheValue} '
        )
    );
    environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY = 'environment-one';
    await build('cache-prime');
    await build('cache-repeat');
    assert.match(await logs('cache-repeat'), /web:build: cache hit/);
    const built = await readFile(output, 'utf8');
    await unlink(output);
    await build('cache-restore');
    assert.equal(await readFile(output, 'utf8'), built);
    assert.match(
      await logs('cache-restore'),
      /@repo\/validation:build: cache hit/
    );
    environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY = 'environment-two';
    await build('cache-environment');
    await miss('cache-environment', 'web');
    assert.match(
      await readFile(html, 'utf8'),
      /data-cache-probe="environment-two"/
    );
    await Bun.write(
      shared,
      originalShared + '\nexport const fixtureCacheValue = "shared-two";\n'
    );
    await build('cache-shared-input');
    await miss('cache-shared-input', '@repo/validation');
    await miss('cache-shared-input', 'web');
    assert.match(await readFile(output, 'utf8'), /shared-two/);
    assert.match(
      await readFile(html, 'utf8'),
      /data-domain-probe="shared-two"/
    );
    delete environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY;
    await Bun.write(
      localEnv,
      (originalEnv ?? '') + '\nNEXT_PUBLIC_FIXTURE_CACHE_KEY=local-one\n'
    );
    await build('cache-local-prime');
    await Bun.write(
      localEnv,
      (originalEnv ?? '') + '\nNEXT_PUBLIC_FIXTURE_CACHE_KEY=local-two\n'
    );
    await build('cache-local-environment');
    await miss('cache-local-environment', 'web');
    assert.match(await readFile(html, 'utf8'), /data-cache-probe="local-two"/);
    await Bun.write(
      join(artifacts, 'turbo-cache.json'),
      JSON.stringify(
        {
          repeatedBuildHit: true,
          artifactRestored: true,
          environmentInvalidated: true,
          sharedInputInvalidated: true,
          localEnvironmentInvalidated: true,
        },
        null,
        2
      )
    );
  } finally {
    await Bun.write(shared, originalShared);
    await Bun.write(page, originalPage);
    if (originalEnv === undefined)
      await unlink(localEnv).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    else await Bun.write(localEnv, originalEnv);
    if (originalValue === undefined)
      delete environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY;
    else environment.NEXT_PUBLIC_FIXTURE_CACHE_KEY = originalValue;
  }
}
