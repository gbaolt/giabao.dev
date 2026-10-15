import type { EmitCtx } from '../../types/generate';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitEslint(ctx: EmitCtx): void {
  ctx.pkg.scripts.lint = 'eslint .';
  ctx.pkg.devDependencies.eslint = DEPENDENCY_VERSIONS['eslint'];
  ctx.pkg.devDependencies['eslint-plugin-react-hooks'] =
    DEPENDENCY_VERSIONS['eslint-plugin-react-hooks'];
  const isNext = ctx.stack.frontend === 'next';
  if (isNext) {
    ctx.pkg.devDependencies['eslint-config-next'] =
      DEPENDENCY_VERSIONS['eslint-config-next'];
    // Next 15's resolver patch omits these plugins under isolated installs.
    ctx.pkg.devDependencies['@next/eslint-plugin-next'] =
      DEPENDENCY_VERSIONS['@next/eslint-plugin-next'];
  } else {
    for (const dependency of [
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'eslint-plugin-react',
    ]) {
      ctx.pkg.devDependencies[dependency] = DEPENDENCY_VERSIONS[dependency];
    }
  }
  ctx.pkg.devDependencies['@eslint/eslintrc'] =
    DEPENDENCY_VERSIONS['@eslint/eslintrc'];
  setFile(
    ctx.files,
    'eslint.config.mjs',
    `import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  ...compat.extends(${isNext ? "'next/core-web-vitals', 'next/typescript'" : "'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended', 'plugin:@typescript-eslint/recommended'"}),
  {
    ignores: [
      '**/.next/**',
      '**/next-env.d.ts',
      '**/dist/**',
      '**/.output/**',
      '**/.vinxi/**',
      '**/node_modules/**',
    ],
  },
${isNext ? '' : "  { settings: { react: { version: 'detect' } } },\n"}];

export default eslintConfig;
`
  );
}
