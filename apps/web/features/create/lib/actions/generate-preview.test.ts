import { expect, test } from 'bun:test';

import { YES_DEFAULTS } from '../compat';
import { generatePreview } from './generate-preview';
test('generatePreview rejects invalid flags', async () => {
  const result = await generatePreview(
    { frontend: 'next' } as never,
    'my-gb-app'
  );
  expect(result).toEqual({
    ok: false,
    message: 'invalid flags',
    code: 'invalid',
  });
});
test('generatePreview returns the YES tree', async () => {
  const result = await generatePreview(YES_DEFAULTS, 'my-gb-app');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(Object.keys(result.files)).toContain('package.json');
  expect(Object.keys(result.files)).toContain('README.md');
  expect(result.files['app/layout.tsx']).toBeDefined();
  expect(result.files['apps/web/package.json']).toBeUndefined();
  expect(result.files['components/login-form.tsx']).toContain(
    'return (\n    <Card>'
  );
});
test('preview follows the command package manager for workspace configuration', async () => {
  for (const manager of ['bun', 'pnpm', 'yarn', 'npm'] as const) {
    const result = await generatePreview(
      {
        ...YES_DEFAULTS,
        backend: 'hono',
        structure: 'monorepo',
        addons: {
          ...YES_DEFAULTS.addons,
          taskRunner: 'turborepo',
        },
      },
      'manager-app',
      manager
    );
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    const root = JSON.parse(result.files['package.json']);
    expect(root.packageManager).toStartWith(`${manager}@`);
    expect(result.files['pnpm-workspace.yaml'] !== undefined).toBe(
      manager === 'pnpm'
    );
    expect(result.files['.yarnrc.yml'] !== undefined).toBe(manager === 'yarn');
  }
});
