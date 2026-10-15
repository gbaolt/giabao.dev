import { strict as assert } from 'node:assert';
import { join } from 'node:path';

import { chromium } from 'playwright';

const [origin, artifacts] = process.argv.slice(2);
if (!origin || !artifacts)
  throw new Error('Pass the running fixture origin and evidence directory');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  const reads: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/rpc/notes/list'))
      reads.push(request.url());
  });
  await page.goto(`${origin}/notes`, { waitUntil: 'networkidle' });
  assert.ok(
    (await page
      .getByRole('heading', { name: 'Fixture note updated', exact: true })
      .count()) > 0
  );
  assert.equal(
    reads.length,
    0,
    'Fresh SSR data must hydrate without another Notes read'
  );
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByLabel('Body', { exact: true }).fill('Preserve this body');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Title is required' })
    .waitFor();
  assert.equal(
    await page.getByLabel('Body', { exact: true }).inputValue(),
    'Preserve this body'
  );

  const title = `Browser note ${Date.now()}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Title', { exact: true }).inputValue(),
    ''
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  const item = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await item.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`${title} edited`);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('heading', { name: `${title} edited`, exact: true })
    .waitFor();
  await page
    .getByRole('listitem')
    .filter({
      has: page.getByRole('heading', { name: `${title} edited`, exact: true }),
    })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page
    .getByRole('heading', { name: `${title} edited`, exact: true })
    .waitFor({ state: 'detached' });

  await page.route('**/api/rpc/notes/create', (route) => route.abort());
  await page.getByLabel('Title', { exact: true }).fill('Retry this note');
  await page
    .getByLabel('Body', { exact: true })
    .fill('Retained after a network error');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page.getByLabel('Title', { exact: true }).inputValue(),
    'Retry this note'
  );
  assert.equal(
    await page.getByLabel('Body', { exact: true }).inputValue(),
    'Retained after a network error'
  );
  await page.unroute('**/api/rpc/notes/create');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Retry this note', exact: true })
    .waitFor();
  assert.ok(
    reads.length >= 4,
    'Successful mutations must refresh the Notes list'
  );
  assert.deepEqual(
    errors,
    [],
    'Browser must not report runtime or hydration errors'
  );
  await page.screenshot({
    path: join(artifacts, 'browser.png'),
    fullPage: true,
  });
  await Bun.write(
    join(artifacts, 'browser.json'),
    JSON.stringify(
      {
        initialHydrationReads: 0,
        mutationReads: reads.length,
        errors,
        scenarios: [
          'validation',
          'create',
          'reload',
          'edit',
          'delete',
          'failed save',
          'retry',
        ],
      },
      null,
      2
    )
  );
  console.log(
    'Browser CRUD, failure recovery, SSR hydration, and query invalidation passed'
  );
} finally {
  await browser.close();
}
