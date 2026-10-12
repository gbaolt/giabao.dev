import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

const fixtureDirectories: string[] = [];
const documentModule = path.join(import.meta.dir, '../document.ts');

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function loadDocument(createdAt: string) {
  const directory = mkdtempSync(path.join(tmpdir(), 'giabao-document-'));
  fixtureDirectories.push(directory);
  const filePath = path.join(directory, 'docs/blog/post.mdx');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `---\ntitle: Test post\ndescription: Test document loading.\n${createdAt}\nupdatedAt: 2026-10-12\n---\n\nPost content.`
  );

  const result = spawnSync(
    process.execPath,
    [
      '--eval',
      `import { getAllDocs } from ${JSON.stringify(documentModule)};
       console.log(JSON.stringify(getAllDocs().map(({ slug }) => slug)));`,
    ],
    { cwd: directory, encoding: 'utf8' }
  );

  return { filePath, ...result };
}

test.each(['2026-10-11', '"2026-10-11"'])(
  'loads a valid quoted or unquoted creation date: %s',
  (date) => {
    const result = loadDocument(`createdAt: ${date}`);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('["post"]');
  }
);

test.each([
  '',
  'createdAt: not-a-date',
  'createdAt: ""',
  'createdAt: null',
  'createdAt: 0',
  'createdAt: true',
  'createdAt: "999999-01-01"',
])('rejects invalid creation dates and identifies the MDX file: %s', (date) => {
  const result = loadDocument(date);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    `${result.filePath} has an invalid createdAt`
  );
});
