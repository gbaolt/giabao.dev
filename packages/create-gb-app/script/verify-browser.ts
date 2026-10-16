import { strict as assert } from 'node:assert';
import { join } from 'node:path';

import { chromium } from 'playwright';

const [origin, artifacts, auth] = process.argv.slice(2);
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
  if (auth === 'better-auth') {
    assert.ok(
      page.url().includes('/login'),
      'Anonymous navigation must lead to signin'
    );
    await page.getByLabel('Email', { exact: true }).fill('fixture@example.com');
    await page
      .getByLabel('Password', { exact: true })
      .fill('fixture-test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/notes');
    await page.waitForLoadState('networkidle');
  }
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
  const retryTitle = `Retry this note ${Date.now()}`;
  await page.getByLabel('Title', { exact: true }).fill(retryTitle);
  await page
    .getByLabel('Body', { exact: true })
    .fill('Retained after a network error');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page.getByLabel('Title', { exact: true }).inputValue(),
    retryTitle
  );
  assert.equal(
    await page.getByLabel('Body', { exact: true }).inputValue(),
    'Retained after a network error'
  );
  await page.unroute('**/api/rpc/notes/create');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('heading', { name: retryTitle, exact: true }).waitFor();
  assert.ok(
    reads.length >= 4,
    'Successful mutations must refresh the Notes list'
  );
  if (auth === 'better-auth') {
    let releaseRead = () => {};
    let responseReady = () => {};
    const release = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      responseReady = resolve;
    });
    await page.route('**/api/rpc/notes/list', async (route) => {
      const response = await route.fetch();
      assert.ok((await response.text()).includes('Fixture note updated'));
      responseReady();
      await release;
      await route.fulfill({ response }).catch(() => {});
    });
    await page
      .getByLabel('Title', { exact: true })
      .fill('Previous account late note');
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await ready;
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/login');
    await page
      .getByRole('button', { name: 'Create an account', exact: true })
      .click();
    await page.getByLabel('Name', { exact: true }).fill('Browser second user');
    await page
      .getByLabel('Email', { exact: true })
      .fill(`browser-${Date.now()}@example.com`);
    await page
      .getByLabel('Password', { exact: true })
      .fill('fixture-test-password');
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await page.waitForURL('**/notes');
    releaseRead();
    await page.unroute('**/api/rpc/notes/list');
    await page.waitForLoadState('networkidle');
    assert.equal(
      await page
        .getByRole('heading', { name: 'Fixture note updated', exact: true })
        .count(),
      0
    );
    assert.equal(
      await page
        .getByRole('heading', {
          name: 'Previous account late note',
          exact: true,
        })
        .count(),
      0
    );
    await page
      .getByLabel('Title', { exact: true })
      .fill('Browser second account note');
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page
      .getByRole('heading', {
        name: 'Browser second account note',
        exact: true,
      })
      .waitFor();
    console.log(
      'Browser signin, signup, signout, and account switching with an in-flight private response passed'
    );
  }
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
