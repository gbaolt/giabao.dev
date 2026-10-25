import type { EmitCtx } from '../../types/generate';
import shadcnSource from '../assets/shadcn/formatted-source.json';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { type DocumentWrapper, manifestSections } from '../project-model';

export function emitShadcn(ctx: EmitCtx): void {
  if (ctx.layout.structure === 'monorepo') {
    emitSharedShadcn(ctx);
    return;
  }

  for (const dependency of [
    '@base-ui/react',
    'class-variance-authority',
    'cn',
    'lucide-react',
    'next-themes',
    'shadcn',
    'tw-animate-css',
  ]) {
    ctx.pkg.dependencies[dependency] = DEPENDENCY_VERSIONS[dependency];
  }

  const root = ctx.layout.sourceRoot ? `${ctx.layout.sourceRoot}/` : '';
  const css = ctx.layout.stylesFile;

  setFile(ctx.files, `${root}lib/utils.ts`, shadcnSource['lib/utils.ts']);

  const config = JSON.parse(shadcnSource['components.json']) as {
    rsc: boolean;
    tailwind: { css: string };
  };
  config.rsc = ctx.stack.frontend === 'next';
  config.tailwind.css = css;
  setFile(ctx.files, 'components.json', JSON.stringify(config, null, 2));

  setFile(ctx.files, css, appStyles(ctx, shadcnSource['app/globals.css']));

  setFile(
    ctx.files,
    `${root}components/ui/button.tsx`,
    shadcnSource['components/ui/button.tsx']
  );

  setFile(
    ctx.files,
    `${root}components/ui/input.tsx`,
    shadcnSource['components/ui/input.tsx']
  );

  setFile(
    ctx.files,
    `${root}components/ui/card.tsx`,
    shadcnSource['components/ui/card.tsx']
  );

  for (const component of [
    'checkbox',
    'field',
    'label',
    'select',
    'separator',
    'textarea',
  ] as const) {
    const path = `components/ui/${component}.tsx` as const;
    setFile(ctx.files, `${root}${path}`, shadcnSource[path]);
  }

  setFile(
    ctx.files,
    `${root}components/theme-provider.tsx`,
    shadcnSource['components/theme-provider.tsx']
  );
  if (ctx.stack.frontend === 'next')
    ctx.project.documentWrappers.push(nextThemeWrapper('@/lib/utils'));
  else emitStartTheme(ctx, ctx.pkg.dependencies);
}

function emitSharedShadcn(ctx: EmitCtx): void {
  const webRoot = `${ctx.layout.frontendRoot}/`;
  const isNext = ctx.stack.frontend === 'next';
  const webSourceRoot = `${ctx.layout.sourceRoot}/`;
  const webCss = ctx.layout.stylesFile;
  const sharedCss = 'packages/ui/src/styles/globals.css';

  const uiPackage = manifestSections(
    ctx.project,
    'packages/ui/package.json'
  ) as ReturnType<typeof manifestSections> & {
    exports: Record<string, string>;
  };
  const webPackage = manifestSections(ctx.project, ctx.layout.frontendManifest);

  for (const dependency of [
    '@base-ui/react',
    'class-variance-authority',
    'cn',
    'lucide-react',
    'shadcn',
    'tw-animate-css',
  ]) {
    uiPackage.dependencies[dependency] = DEPENDENCY_VERSIONS[dependency];
  }
  uiPackage.devDependencies.tailwindcss ??= DEPENDENCY_VERSIONS.tailwindcss;
  uiPackage.devDependencies['@tailwindcss/postcss'] ??=
    DEPENDENCY_VERSIONS['@tailwindcss/postcss'];
  uiPackage.dependencies['react-dom'] = DEPENDENCY_VERSIONS['react-dom'];
  webPackage.dependencies['next-themes'] = DEPENDENCY_VERSIONS['next-themes'];

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
  ] as const) {
    const sourcePath = `components/ui/${component}.tsx` as const;
    const content = shadcnSource[sourcePath].replaceAll(
      '@/components/ui/',
      '@repo/ui/'
    );
    setFile(ctx.files, `packages/ui/src/${component}.tsx`, content);
    uiPackage.exports[`./${component}`] = `./src/${component}.tsx`;
  }
  setFile(ctx.files, 'packages/ui/src/utils.ts', shadcnSource['lib/utils.ts']);
  uiPackage.exports['./utils'] = './src/utils.ts';
  uiPackage.exports['./components/*'] = './src/*.tsx';
  // Explicit directory aliases avoid CLI 4.21 treating Windows paths as file extensions.
  uiPackage.exports['./components'] = './src';
  uiPackage.exports['./lib'] = './src/lib';
  uiPackage.exports['./hooks'] = './src/hooks';
  uiPackage.exports['./lib/*'] = './src/lib/*.ts';
  uiPackage.exports['./hooks/*'] = './src/hooks/*.ts';
  uiPackage.exports['./globals.css'] = './src/styles/globals.css';

  const css = shadcnSource['app/globals.css'].replace(
    '@custom-variant dark (&:is(.dark *));',
    '@custom-variant dark (&:is(.dark *));\n@source "../../../../apps/**/*.{ts,tsx}";\n@source "../**/*.{ts,tsx}";'
  );
  setFile(ctx.files, sharedCss, css);
  setFile(ctx.files, webCss, appStyles(ctx, '@import "@repo/ui/globals.css";\n'));

  const appConfig = JSON.parse(shadcnSource['components.json']) as {
    rsc: boolean;
    tailwind: { css: string };
    aliases: Record<string, string>;
  };
  appConfig.rsc = isNext;
  appConfig.tailwind.css = '../../packages/ui/src/styles/globals.css';
  appConfig.aliases.ui = '@repo/ui/components';
  appConfig.aliases.utils = '@repo/ui/utils';
  setFile(
    ctx.files,
    `${webRoot}components.json`,
    JSON.stringify(appConfig, null, 2)
  );

  const uiConfig = JSON.parse(shadcnSource['components.json']) as {
    rsc: boolean;
    tailwind: { css: string };
    aliases: Record<string, string>;
  };
  uiConfig.rsc = isNext;
  uiConfig.tailwind.css = 'src/styles/globals.css';
  uiConfig.aliases = {
    components: '@repo/ui/components',
    utils: '@repo/ui/utils',
    ui: '@repo/ui/components',
    lib: '@repo/ui/lib',
    hooks: '@repo/ui/hooks',
  };
  setFile(
    ctx.files,
    'packages/ui/components.json',
    JSON.stringify(uiConfig, null, 2)
  );
  setFile(
    ctx.files,
    'packages/ui/tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['DOM', 'DOM.Iterable', 'ES2022'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          paths: {
            '@repo/ui/components': ['./src'],
            '@repo/ui/components/*': ['./src/*'],
            '@repo/ui/utils': ['./src/utils.ts'],
            '@repo/ui/lib': ['./src/lib'],
            '@repo/ui/lib/*': ['./src/lib/*'],
            '@repo/ui/hooks': ['./src/hooks'],
            '@repo/ui/hooks/*': ['./src/hooks/*'],
          },
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      },
      null,
      2
    )
  );
  setFile(
    ctx.files,
    `${webSourceRoot}components/theme-provider.tsx`,
    shadcnSource['components/theme-provider.tsx']
  );
  if (isNext) {
    ctx.project.documentWrappers.push(nextThemeWrapper('@repo/ui/utils'));
  } else {
    emitStartTheme(ctx, webPackage.dependencies);
  }
}

function emitStartTheme(
  ctx: EmitCtx,
  dependencies: Record<string, string>
): void {
  dependencies['@fontsource-variable/geist'] =
    DEPENDENCY_VERSIONS['@fontsource-variable/geist'];
  dependencies['@fontsource-variable/geist-mono'] =
    DEPENDENCY_VERSIONS['@fontsource-variable/geist-mono'];
  ctx.project.documentWrappers.push({
    imports: 'import { ThemeProvider } from "../components/theme-provider";\n',
    component: 'ThemeProvider',
    htmlAttributes: ['className="font-sans antialiased"', 'suppressHydrationWarning'],
  });
}

/** The app stylesheet; Start loads the Geist fonts that Next gets from next/font. */
function appStyles(ctx: EmitCtx, css: string): string {
  if (ctx.stack.frontend === 'next') return css;
  return (
    '@import "@fontsource-variable/geist";\n@import "@fontsource-variable/geist-mono";\n' +
    (css.endsWith('\n') ? css : `${css}\n`) +
    '\n@theme inline {\n  --font-sans: "Geist Variable", sans-serif;\n  --font-mono: "Geist Mono Variable", monospace;\n}\n'
  );
}

function nextThemeWrapper(utilsImport: string): DocumentWrapper {
  return {
    imports: `import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '${utilsImport}';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

`,
    component: 'ThemeProvider',
    htmlAttributes: [
      'suppressHydrationWarning',
      `className={cn(
        'antialiased',
        'font-sans',
        geist.variable,
        geistMono.variable
      )}`,
    ],
  };
}
