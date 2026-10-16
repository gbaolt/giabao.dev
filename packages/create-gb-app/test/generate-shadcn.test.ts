import { expect, test } from 'bun:test';

import { buildTree, resolveStack, SHADCN_FOUNDATION } from '#/generate/public';
test('generated Next app includes the official Base UI button', () => {
  const files = buildTree(resolveStack({ yes: true }), {
    projectName: 'shadcn-next',
    packageManager: 'bun',
  });
  expect(files['components/ui/button.tsx']).toContain(
    "import { Button as ButtonPrimitive } from '@base-ui/react/button'"
  );
});
test('generated Next app includes the official form controls and their dependencies', () => {
  const files = buildTree(resolveStack({ yes: true }), {
    projectName: 'shadcn-next',
    packageManager: 'bun',
  });
  for (const component of [
    'button',
    'card',
    'checkbox',
    'field',
    'input',
    'label',
    'select',
    'separator',
    'textarea',
  ]) {
    expect(files[`components/ui/${component}.tsx`]).toBeDefined();
  }
  expect(files['components/ui/select.tsx']).toContain('@base-ui/react/select');
  expect(files['components/ui/input.tsx']).toContain('@base-ui/react/input');
  expect(files['components/ui/checkbox.tsx']).toContain(
    '@base-ui/react/checkbox'
  );
  expect(files['components/ui/card.tsx']).toContain('CardHeader');
  expect(files['components/ui/field.tsx']).toContain('FieldGroup');
});
test('generated Next app carries the resolved preset theme and installable dependencies', () => {
  const files = buildTree(resolveStack({ yes: true }), {
    projectName: 'shadcn-next',
    packageManager: 'bun',
  });
  const config = JSON.parse(files['components.json']!);
  const pkg = JSON.parse(files['package.json']!);
  expect(config.style).toBe('base-nova');
  expect(config.tailwind.baseColor).toBe('zinc');
  expect(config.tailwind.cssVariables).toBe(true);
  expect(config.iconLibrary).toBe('lucide');
  expect(files['app/globals.css']).toContain('@theme inline');
  expect(files['app/globals.css']).toContain('.dark {');
  expect(files['app/globals.css']).toContain('--primary: oklch(');
  for (const dependency of [
    '@base-ui/react',
    'class-variance-authority',
    'cn',
    'lucide-react',
    'next-themes',
    'shadcn',
    'tw-animate-css',
  ]) {
    expect(pkg.dependencies[dependency]).toBeDefined();
  }
});
test('public generator describes its included UI foundation', () => {
  expect(SHADCN_FOUNDATION.preset).toBe('b1YnQPagE');
  expect(SHADCN_FOUNDATION.base).toBe('base');
  expect(SHADCN_FOUNDATION.style).toBe('nova');
  expect(SHADCN_FOUNDATION.components).toContain('field');
});
test('generated Next layout enables the preset font and light or dark theme', () => {
  const files = buildTree(resolveStack({ yes: true }), {
    projectName: 'shadcn-next',
    packageManager: 'bun',
  });
  expect(files['components/theme-provider.tsx']).toContain('next-themes');
  expect(files['app/layout.tsx']).toContain('Geist');
  expect(files['app/layout.tsx']).toContain('ThemeProvider');
  expect(files['app/layout.tsx']).toContain('suppressHydrationWarning');
});
test('Nest workspace shares the same official UI components with its web app', () => {
  const files = buildTree(
    resolveStack({
      backend: 'nest',
      addons: {
        linting: 'biome',
      },
    }),
    {
      projectName: 'shadcn-nest',
      packageManager: 'pnpm',
    }
  );
  expect(files['packages/ui/src/button.tsx']).toContain(
    '@base-ui/react/button'
  );
  expect(files['packages/ui/src/field.tsx']).toContain('FieldGroup');
  expect(files['packages/ui/src/styles/globals.css']).toContain(
    '@theme inline'
  );
  expect(files['apps/web/app/globals.css']).toContain(
    '@import "@repo/ui/globals.css"'
  );
  expect(files['apps/web/app/layout.tsx']).toContain('ThemeProvider');
  const uiPackage = JSON.parse(files['packages/ui/package.json']!);
  expect(uiPackage.exports['./field']).toBe('./src/field.tsx');
  expect(uiPackage.dependencies['@base-ui/react']).toBeDefined();
  expect(files['packages/ui/tsconfig.json']).toBeDefined();
  const uiConfig = JSON.parse(files['packages/ui/tsconfig.json']!);
  expect(uiConfig.compilerOptions.paths['@repo/ui/lib']).toEqual(['./src/lib']);
  expect(uiConfig.compilerOptions.paths['@repo/ui/hooks']).toEqual([
    './src/hooks',
  ]);
  const webConfig = JSON.parse(files['apps/web/tsconfig.json']!);
  expect(webConfig.compilerOptions.paths['@/*']).toEqual(['./*']);
});
test('Hono workspace uses the same Base UI package and theme', () => {
  const files = buildTree(resolveStack({ backend: 'hono' }), {
    projectName: 'shadcn-hono',
    packageManager: 'npm',
  });
  expect(files['packages/ui/src/button.tsx']).toContain(
    '@base-ui/react/button'
  );
  expect(files['packages/ui/src/select.tsx']).toContain(
    '@base-ui/react/select'
  );
  expect(files['apps/web/app/globals.css']).toContain('@repo/ui/globals.css');
  expect(files['apps/web/app/layout.tsx']).toContain('ThemeProvider');
  expect(files['apps/web/components.json']).toContain('@repo/ui/components');
});
test('TanStack Start includes the same controls with a working theme and Geist font', () => {
  const files = buildTree(
    resolveStack({
      frontend: 'tanstack-start',
      api: 'none',
      database: 'none',
      auth: 'none',
    }),
    {
      projectName: 'shadcn-start',
      packageManager: 'bun',
    }
  );
  const pkg = JSON.parse(files['package.json']!);
  expect(files['src/components/ui/input.tsx']).toContain(
    '@base-ui/react/input'
  );
  expect(files['src/components/theme-provider.tsx']).toContain('next-themes');
  expect(files['src/routes/__root.tsx']).toContain('ThemeProvider');
  expect(files['src/styles.css']).toContain('Geist Variable');
  expect(pkg.dependencies['@fontsource-variable/geist']).toBeDefined();
  expect(pkg.dependencies['@fontsource-variable/geist-mono']).toBeDefined();
});
