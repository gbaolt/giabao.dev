import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [web, origin, authOrigin, backend, api, auth, frontend, scenario] =
  process.argv.slice(2);
const require = createRequire(join(web, 'package.json'));
let cookie = '';
if (auth === 'better-auth') {
  const response = await fetch(`${authOrigin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: authOrigin },
    body: JSON.stringify({
      email:
        scenario === 'dev' ? 'fixture-dev@example.com' : 'fixture@example.com',
      name: 'Fixture',
      password: 'fixture-test-password',
    }),
  });
  assert.equal(response.status, 200, await response.text());
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie, 'Signup must establish a session');
}
const headers = () => ({ cookie });
async function createAccount(email) {
  const response = await fetch(`${authOrigin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: authOrigin },
    body: JSON.stringify({
      email,
      name: 'Second user',
      password: 'fixture-test-password',
    }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
let client;
if (api === 'trpc') {
  const { createTRPCClient, httpBatchLink } = await import(
    require.resolve('@trpc/client')
  );
  const { default: superjson } = await import(require.resolve('superjson'));
  client = createTRPCClient({
    links: [
      httpBatchLink({ url: `${origin}/api/trpc`, transformer: superjson }),
    ],
  });
  const note = await client.notes.create.mutate({
    title: 'Fixture note',
    body: 'Persisted through HTTP',
  });
  assert.ok(
    (await client.notes.list.query()).some((value) => value.id === note.id)
  );
} else {
  const { createORPCClient } = await import(require.resolve('@orpc/client'));
  if (backend === 'nest') {
    const { OpenAPILink } = await import(
      require.resolve('@orpc/openapi/fetch')
    );
    const { contract } = await import(
      pathToFileURL(require.resolve('@repo/contract')).href
    );
    client = createORPCClient(
      new OpenAPILink(contract, { url: authOrigin, headers })
    );
  } else {
    const { RPCLink } = await import(require.resolve('@orpc/client/fetch'));
    client = createORPCClient(
      new RPCLink({
        url: `${origin}${frontend === 'next' ? '/rpc' : '/api/rpc'}`,
        headers,
      })
    );
  }
  const note = await client.notes.create({
    title: 'Fixture note',
    body: 'Persisted through HTTP',
  });
  assert.ok((await client.notes.list()).some((value) => value.id === note.id));
  await assert.rejects(client.notes.create({ title: '   ', body: '' }));
  if (backend === 'self' && frontend === 'tanstack-start') {
    await client.notes.update({
      id: note.id,
      title: 'Fixture note updated',
      body: 'Edited through HTTP',
    });
    assert.ok(
      (await client.notes.list()).some(
        (value) =>
          value.id === note.id && value.title === 'Fixture note updated'
      )
    );
    const transient = await client.notes.create({
      title: 'Delete this note',
      body: '',
    });
    await client.notes.delete({ id: transient.id });
    assert.ok(
      !(await client.notes.list()).some((value) => value.id === transient.id)
    );
    await assert.rejects(
      client.notes.update({ id: 'missing-record', title: 'Missing', body: '' }),
      { code: 'NOT_FOUND' }
    );
    await assert.rejects(client.notes.delete({ id: 'missing-record' }), {
      code: 'NOT_FOUND',
    });
    const response = await fetch(`${origin}/notes`, { headers: headers() });
    assert.equal(response.status, 200);
    assert.ok(
      (await response.text()).includes('Fixture note updated'),
      'SSR must include persisted Notes before JavaScript'
    );
    assert.equal(
      (
        await fetch(`${origin}/api/rpc/unknown`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
      404
    );
    if (auth === 'better-auth') {
      const ownerCookie = cookie;
      const owner = await client.me();
      cookie = '';
      for (const action of [
        () => client.notes.list(),
        () => client.notes.create({ title: 'Anonymous', body: '' }),
        () =>
          client.notes.update({ id: note.id, title: 'Anonymous', body: '' }),
        () => client.notes.delete({ id: note.id }),
      ])
        await assert.rejects(action(), { code: 'UNAUTHORIZED' });
      cookie = await createAccount(
        scenario === 'dev' ? 'second-dev@example.com' : 'second@example.com'
      );
      const secondCookie = cookie;
      assert.ok(
        !(await client.notes.list()).some((value) => value.id === note.id)
      );
      await assert.rejects(
        client.notes.update({ id: note.id, title: 'Stolen', body: '' }),
        { code: 'NOT_FOUND' }
      );
      await assert.rejects(client.notes.delete({ id: note.id }), {
        code: 'NOT_FOUND',
      });
      const secondNote = await client.notes.create({
        title: 'Second user private note',
        body: '',
        userId: owner.id,
      });
      cookie = ownerCookie;
      assert.ok(
        !(await client.notes.list()).some((value) => value.id === secondNote.id)
      );
      const pages = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          fetch(`${origin}/notes`, {
            headers: { cookie: index % 2 === 0 ? ownerCookie : secondCookie },
          })
        )
      );
      for (const [index, response] of pages.entries()) {
        assert.match(
          response.headers.get('cache-control'),
          /private.*no-store/
        );
        const html = await response.text();
        assert.ok(
          html.includes(
            index % 2 === 0
              ? 'Fixture note updated'
              : 'Second user private note'
          )
        );
        assert.ok(
          !html.includes(
            index % 2 === 0
              ? 'Second user private note'
              : 'Fixture note updated'
          )
        );
      }
      const privateResponse = await fetch(`${origin}/api/rpc/notes/list`, {
        method: 'POST',
        headers: { cookie: ownerCookie, 'content-type': 'application/json' },
        body: '{}',
      });
      assert.match(
        privateResponse.headers.get('cache-control'),
        /private.*no-store/
      );
      const signedOut = await fetch(`${origin}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          cookie: secondCookie,
          origin,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      assert.equal(signedOut.status, 200);
      cookie = secondCookie;
      await assert.rejects(client.notes.list(), { code: 'UNAUTHORIZED' });
      cookie = ownerCookie;
      console.log(
        'Anonymous rejection, two-user ownership, forged identity, concurrent SSR isolation, and signout passed'
      );
    }
  }
}
assert.equal(
  (await fetch(`${origin}/notes`, { headers: headers() })).status,
  200
);
console.log('Real HTTP Notes write/read and route checks passed');
