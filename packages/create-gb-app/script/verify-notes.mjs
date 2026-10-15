import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [web, origin, authOrigin, backend, api, auth] = process.argv.slice(2);
const require = createRequire(join(web, 'package.json'));
let cookie = '';
if (auth === 'better-auth') {
  const response = await fetch(`${authOrigin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: authOrigin },
    body: JSON.stringify({
      email: 'fixture@example.com',
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
        url:
          backend === 'self' && origin.includes('127.0.0.1')
            ? `${origin}/rpc`
            : origin,
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
}
assert.equal(
  (await fetch(`${origin}/notes`, { headers: headers() })).status,
  200
);
console.log('Real HTTP Notes write/read and route checks passed');
