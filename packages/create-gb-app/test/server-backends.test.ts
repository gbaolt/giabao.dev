import { describe, expect, test } from 'bun:test';

import { buildTree } from '#/generate/build-tree';
import { resolveStack } from '#/stack/resolve';
import type { RawFlags } from '#/types/stack';

const ctx = { projectName: 'server-app', packageManager: 'pnpm' } as const;

function build(flags: RawFlags) {
  return buildTree(resolveStack(flags), ctx);
}

function loginPage(files: Record<string, string>, frontend: string) {
  return frontend === 'next'
    ? files['apps/web/app/login/page.tsx']
    : files['apps/web/src/routes/login.tsx'];
}

describe('server backend regressions', () => {
  test.each(['next', 'tanstack-start'] as const)(
    'Hono Better Auth has a login page on %s',
    (frontend) => {
      const files = build({ backend: 'hono', frontend, auth: 'better-auth' });
      expect(loginPage(files, frontend)).toContain('LoginForm');
      expect(
        files[
          frontend === 'next'
            ? 'apps/web/components/login-form.tsx'
            : 'apps/web/src/components/login-form.tsx'
        ]
      ).toContain('authClient');
    }
  );

  test.each([
    ['next', 'none'],
    ['next', 'clerk'],
    ['tanstack-start', 'none'],
    ['tanstack-start', 'clerk'],
  ] as const)(
    'Nest oRPC on %s with auth %s has no placeholder login page',
    (frontend, auth) => {
      const files = build({ backend: 'nest', frontend, api: 'orpc', auth });
      expect(loginPage(files, frontend)).toBeUndefined();
      expect(
        Object.keys(files).some((path) => path.endsWith('auth-client.ts'))
      ).toBe(false);
    }
  );
});
