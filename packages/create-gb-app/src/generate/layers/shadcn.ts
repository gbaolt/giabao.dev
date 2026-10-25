import type { EmitCtx } from '../../types/generate';
import shadcnSource from '../assets/shadcn/formatted-source.json';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile, setFileIfAbsent } from '../files';

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

  setFile(ctx.files, css, shadcnSource['app/globals.css']);

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

  if (ctx.stack.frontend === 'next') {
    setFile(
      ctx.files,
      `${root}components/theme-provider.tsx`,
      shadcnSource['components/theme-provider.tsx']
    );
    const layoutPath = ctx.layout.rootLayout;
    const layout = ctx.files[layoutPath];
    if (layout === undefined) {
      throw new Error(`missing generated Next layout: ${layoutPath}`);
    }
    setFile(ctx.files, layoutPath, withNextTheme(layout, '@/lib/utils'));
  } else {
    emitStartTheme(ctx, root, ctx.pkg.dependencies);
  }
}

function emitSharedShadcn(ctx: EmitCtx): void {
  const webRoot = `${ctx.layout.frontendRoot}/`;
  const isNext = ctx.stack.frontend === 'next';
  const webSourceRoot = `${ctx.layout.sourceRoot}/`;
  const webCss = ctx.layout.stylesFile;
  const sharedCss = 'packages/ui/src/styles/globals.css';

  const uiManifest = ctx.files['packages/ui/package.json'];
  const webManifest = ctx.files[ctx.layout.frontendManifest];
  if (uiManifest === undefined || webManifest === undefined) {
    throw new Error('missing generated workspace manifests for shadcn');
  }
  const uiPackage = JSON.parse(uiManifest) as {
    exports: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const webPackage = JSON.parse(webManifest) as {
    dependencies: Record<string, string>;
  };

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
  setFile(ctx.files, webCss, '@import "@repo/ui/globals.css";\n');

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
    'packages/ui/package.json',
    JSON.stringify(uiPackage, null, 2)
  );
  setFile(
    ctx.files,
    ctx.layout.frontendManifest,
    JSON.stringify(webPackage, null, 2)
  );

  setFile(
    ctx.files,
    `${webSourceRoot}components/theme-provider.tsx`,
    shadcnSource['components/theme-provider.tsx']
  );
  if (isNext) {
    setFileIfAbsent(
      ctx.files,
      `${webRoot}tsconfig.json`,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2017',
            lib: ['DOM', 'DOM.Iterable', 'ESNext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'ESNext',
            moduleResolution: 'Bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] },
          },
          include: [
            'next-env.d.ts',
            '**/*.ts',
            '**/*.tsx',
            '.next/types/**/*.ts',
          ],
          exclude: ['node_modules'],
        },
        null,
        2
      )
    );
    const layoutPath = ctx.layout.rootLayout;
    const layout = ctx.files[layoutPath];
    if (layout === undefined) {
      throw new Error(`missing generated Next layout: ${layoutPath}`);
    }
    setFile(ctx.files, layoutPath, withNextTheme(layout, '@repo/ui/utils'));
  } else {
    emitStartTheme(ctx, webSourceRoot, webPackage.dependencies);
    setFile(
      ctx.files,
      ctx.layout.frontendManifest,
      JSON.stringify(webPackage, null, 2)
    );
  }
}

function emitStartTheme(
  ctx: EmitCtx,
  root: string,
  dependencies: Record<string, string>
): void {
  dependencies['@fontsource-variable/geist'] =
    DEPENDENCY_VERSIONS['@fontsource-variable/geist'];
  dependencies['@fontsource-variable/geist-mono'] =
    DEPENDENCY_VERSIONS['@fontsource-variable/geist-mono'];
  setFile(
    ctx.files,
    `${root}components/theme-provider.tsx`,
    shadcnSource['components/theme-provider.tsx']
  );
  const routePath = ctx.layout.rootLayout;
  const route = ctx.files[routePath];
  if (route === undefined) {
    throw new Error(`missing generated Start root route: ${routePath}`);
  }
  setFile(
    ctx.files,
    routePath,
    'import { ThemeProvider } from "../components/theme-provider";\n' +
      route
        .replace(
          '<html lang="en">',
          '<html lang="en" className="font-sans antialiased" suppressHydrationWarning>'
        )
        .replace('<body>', '<body>\n        <ThemeProvider>')
        .replace('</body>', '  </ThemeProvider>\n      </body>')
  );
  const cssPath = ctx.layout.stylesFile;
  setFile(
    ctx.files,
    cssPath,
    '@import "@fontsource-variable/geist";\n@import "@fontsource-variable/geist-mono";\n' +
      ctx.files[cssPath] +
      '\n@theme inline {\n  --font-sans: "Geist Variable", sans-serif;\n  --font-mono: "Geist Mono Variable", monospace;\n}\n'
  );
}

function withNextTheme(layout: string, utilsImport: string): string {
  const imports = `import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '${utilsImport}';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

`;

  return (
    imports +
    layout
      .replace(
        /<html([^>]*)>/,
        `<html
     $1
      suppressHydrationWarning
      className={cn(
        'antialiased',
        'font-sans',
        geist.variable,
        geistMono.variable
      )}
    >`
      )
      .replace(/<body([^>]*)>/, '<body$1>\n        <ThemeProvider>')
      .replace('        <Providers>', '          <Providers>')
      .replace('</body>', '  </ThemeProvider>\n      </body>')
  );
}
