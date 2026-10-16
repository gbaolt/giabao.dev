import { expect, test } from 'bun:test';
import ts from 'typescript';

import { buildTree, resolveStack } from '#/generate/public';
for (const form of ['none', 'react-hook-form', 'tanstack-form'] as const) {
  test(`Next login uses login-03 layout with ${form} fields`, () => {
    const files = buildTree(resolveStack({ yes: true, form }), {
      projectName: 'login-example',
      packageManager: 'bun',
    });
    const page = files['app/login/page.tsx'];
    const login = files['components/login-form.tsx'];
    expect(page).toContain('bg-muted');
    expect(page).toContain('LoginForm');
    expect(login).toContain('CardHeader');
    expect(login).toContain('FieldGroup');
    expect(login).toContain('authClient.signIn.email');
    expect(login).toContain('authClient.signUp.email');
    if (form === 'none') {
      expect(login).toContain('components/ui/input');
      expect(login).not.toContain('useAppForm');
      expect(login).not.toContain('useForm<LoginValues>');
    } else if (form === 'react-hook-form') {
      expect(login).toContain('components/form/form-input');
      expect(login).toContain('useForm<LoginValues>');
    } else {
      expect(login).toContain('useAppForm');
    }
    for (const [path, source] of [
      ['app/login/page.tsx', page],
      ['components/login-form.tsx', login],
    ] as const) {
      const result = ts.transpileModule(source ?? '', {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.Preserve },
      });
      expect(result.diagnostics).toEqual([]);
    }
  });
}
test('Nest and TanStack Start login uses the same form component', () => {
  const files = buildTree(
    resolveStack({
      backend: 'nest',
      frontend: 'tanstack-start',
      api: 'orpc',
      addons: {
        form: 'tanstack-form',
      },
    }),
    { projectName: 'login-example', packageManager: 'bun' }
  );
  expect(files['apps/web/src/routes/login.tsx']).toContain('LoginForm');
  expect(files['apps/web/src/components/login-form.tsx']).toContain(
    'useAppForm'
  );
  expect(files['apps/web/src/components/form/hooks.tsx']).toBeDefined();
  expect(files['apps/web/package.json']).toContain('lucide-react');
});
