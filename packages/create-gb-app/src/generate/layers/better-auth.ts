import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { emitStartOrpcAuth } from './start-orpc-auth';

export function emitBetterAuth(ctx: EmitCtx): void {
  ctx.pkg.dependencies['better-auth'] = DEPENDENCY_VERSIONS['better-auth'];

  if (ctx.stack.backend === 'convex') {
    ctx.pkg.dependencies['@convex-dev/better-auth'] =
      DEPENDENCY_VERSIONS['@convex-dev/better-auth'];
    setFile(
      ctx.files,
      'convex/betterAuth.ts',
      `import { betterAuth } from 'better-auth';
import { convex } from '@convex-dev/better-auth/plugins';

export const auth = betterAuth({
  plugins: [convex()],
});
`
    );
    return;
  }

  const start = ctx.stack.frontend === 'tanstack-start';
  const authPath = start ? 'src/lib/auth.ts' : 'lib/auth.ts';
  const pluginImport = start
    ? `import { tanstackStartCookies } from 'better-auth/tanstack-start';`
    : `import { nextCookies } from 'better-auth/next-js';`;
  const pluginCall = start ? 'tanstackStartCookies()' : 'nextCookies()';
  const drizzle = ctx.stack.orm === 'drizzle';
  const adapterImport = drizzle
    ? `import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';`
    : `import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';`;
  const adapterCall = drizzle
    ? `drizzleAdapter(db, {
    schema,
    provider: '${ctx.stack.database === 'sqlite' ? 'sqlite' : ctx.stack.database === 'mysql' ? 'mysql' : 'pg'}',
  })`
    : `prismaAdapter(prisma, {
    provider: '${ctx.stack.database === 'sqlite' ? 'sqlite' : ctx.stack.database === 'mysql' ? 'mysql' : 'postgresql'}',
  })`;

  setFile(
    ctx.files,
    authPath,
    `import { betterAuth } from 'better-auth';
${adapterImport}
${pluginImport}

export const auth = betterAuth({
  database: ${adapterCall},
  emailAndPassword: {
    enabled: true,
  },
  plugins: [${pluginCall}],
});
`
  );

  if (start) {
    setFile(
      ctx.files,
      'src/lib/auth-client.ts',
      `import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
`
    );
    if (ctx.stack.backend === 'self' && ctx.stack.api === 'orpc')
      emitStartOrpcAuth(ctx);
    return;
  }

  setFile(
    ctx.files,
    'lib/auth-client.ts',
    `import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
`
  );

  setFile(
    ctx.files,
    'app/api/auth/[...all]/route.ts',
    `import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
`
  );

  setFile(
    ctx.files,
    'app/login/page.tsx',
    `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const result =
      mode === 'signup'
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? 'Authentication failed');
      return;
    }
    router.push('/notes');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <Card className="flex flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          {mode === 'signup' ? (
            <Input
              name="name"
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          ) : null}
          <Input
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit">
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>
        <button
          className="text-sm underline"
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin'
            ? 'Need an account? Sign up'
            : 'Have an account? Sign in'}
        </button>
      </Card>
    </main>
  );
}
`
  );
}
