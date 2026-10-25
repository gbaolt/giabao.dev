import type { Stack } from '#/types/stack';

import type { EmitCtx } from '../../types/generate';
import stylesSource from '../assets/styles/source.json';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';
import { joinPath } from '../layout';
import { setRootDocument } from '../project-model';

export function emitStart(ctx: EmitCtx): void {
  ctx.pkg.dependencies['@tanstack/router-core'] =
    DEPENDENCY_VERSIONS['@tanstack/router-core'];
  ctx.pkg.scripts.dev = 'vite dev';
  ctx.pkg.scripts.build = 'vite build';
  ctx.pkg.scripts.start = 'vite preview';
  ctx.pkg.dependencies['@tanstack/react-start'] =
    DEPENDENCY_VERSIONS['@tanstack/react-start'];
  ctx.pkg.dependencies['@tanstack/react-router'] =
    DEPENDENCY_VERSIONS['@tanstack/react-router'];
  ctx.pkg.dependencies['@tanstack/react-router-devtools'] =
    DEPENDENCY_VERSIONS['@tanstack/react-router-devtools'];
  ctx.pkg.dependencies.react = DEPENDENCY_VERSIONS['react'];
  ctx.pkg.dependencies['react-dom'] = DEPENDENCY_VERSIONS['react-dom'];
  ctx.pkg.devDependencies['@tailwindcss/vite'] =
    DEPENDENCY_VERSIONS['@tailwindcss/vite'];
  ctx.pkg.devDependencies['@types/node'] = DEPENDENCY_VERSIONS['@types/node'];
  ctx.pkg.devDependencies['@types/react'] = DEPENDENCY_VERSIONS['@types/react'];
  ctx.pkg.devDependencies['@types/react-dom'] =
    DEPENDENCY_VERSIONS['@types/react-dom'];
  ctx.pkg.devDependencies['@vitejs/plugin-react'] =
    DEPENDENCY_VERSIONS['@vitejs/plugin-react'];
  ctx.pkg.devDependencies.tailwindcss = DEPENDENCY_VERSIONS['tailwindcss'];
  ctx.pkg.devDependencies.typescript = DEPENDENCY_VERSIONS['typescript'];
  ctx.pkg.devDependencies.vite = DEPENDENCY_VERSIONS['vite'];
  ctx.pkg.devDependencies['vite-tsconfig-paths'] =
    DEPENDENCY_VERSIONS['vite-tsconfig-paths'];

  const { layout } = ctx;
  const web = (path: string) => joinPath(layout.frontendRoot, path);
  setFile(
    ctx.files,
    web('tsconfig.json'),
    layout.structure === 'single'
      ? startRootTsconfig()
      : JSON.stringify(
          {
            extends: '@repo/typescript-config/base.json',
            ...JSON.parse(startRootTsconfig()),
          },
          null,
          2
        )
  );
  setFile(ctx.files, web('vite.config.ts'), startViteConfig());
  setFile(ctx.files, layout.stylesFile, stylesSource['globals.css']);
  setFile(ctx.files, joinPath(layout.sourceRoot, 'router.tsx'), startRouter());
  const rootRoute = startRootRoute(
    ctx.projectName,
    ctx.stack.backend === 'self' && ctx.stack.api === 'orpc'
  );
  setRootDocument(ctx.project, (wrappers) => {
    const attributes = wrappers.flatMap((wrapper) => wrapper.htmlAttributes);
    let source =
      wrappers.map((wrapper) => wrapper.imports).join('') +
      rootRoute.replace(
        '<html lang="en">',
        `<html lang="en"${attributes.map((attribute) => ` ${attribute}`).join('')}>`
      );
    // shortcut: indentation is exact for one wrapper only; fix it when a second wrapper exists.
    for (const { component } of [...wrappers].reverse())
      source = source
        .replace('<body>', `<body>\n        <${component}>`)
        .replace('</body>', `  </${component}>\n      </body>`);
    return source;
  });
  setFile(
    ctx.files,
    layout.route(''),
    startIndexRoute(ctx.projectName, startNotesLink(ctx.stack))
  );
  ctx.project.ignoreLines.push(
    'node_modules',
    '.output',
    '.vinxi',
    'dist',
    '.env',
    '*.log'
  );
}

function startNotesLink(stack: Stack): boolean {
  switch (stack.backend) {
    case 'convex':
      return true;
    case 'self':
    case 'nest':
    case 'hono':
      return stack.database !== 'none';
    default: {
      const _exhaustive: never = stack;
      throw new Error(`unhandled backend: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function startRootTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        types: ['vite/client', '@tanstack/react-start'],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src', 'vite.config.ts'],
    },
    null,
    2
  );
}

function startViteConfig(): string {
  return `import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST,
  },
  preview: { port: Number(process.env.PORT ?? 4173), host: process.env.HOST },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
});
`;
}

function startRouter(): string {
  return `import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}
`;
}

function startRootRoute(projectName: string, withQueryClient = false): string {
  return `import { HeadContent, Outlet, Scripts, ${withQueryClient ? 'createRootRouteWithContext' : 'createRootRoute'} } from "@tanstack/react-router";
${withQueryClient ? 'import type { QueryClient } from "@tanstack/react-query";\n' : ''}
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import appCss from "../styles.css?url";
import { Providers } from "../components/providers";

export const Route = ${withQueryClient ? 'createRootRouteWithContext<{ queryClient: QueryClient }>()' : 'createRootRoute'}({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "${projectName}" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
          <Providers>
            <Outlet />
          </Providers>
          <TanStackRouterDevtools />
          <Scripts />
      </body>
    </html>
  );
}
`;
}

function startIndexRoute(projectName: string, notesLink: boolean): string {
  return `import { ${notesLink ? 'Link, ' : ''}createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">${projectName}</h1>
      ${
        notesLink
          ? `<p>
        <Link className="underline" to="/notes">
          Open notes
        </Link>
      </p>`
          : ''
      }
    </main>
  );
}
`;
}
