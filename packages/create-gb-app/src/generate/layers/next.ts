import type { EmitCtx } from '../../types/generate';
import nextSource from '../assets/next/source.json';
import { DEPENDENCY_VERSIONS } from '../dependency-versions';
import { setFile } from '../files';

export function emitNext(ctx: EmitCtx): void {
  ctx.pkg.scripts.dev = 'next dev';
  ctx.pkg.scripts.build = 'next build';
  ctx.pkg.scripts.start = 'next start';
  ctx.pkg.dependencies.next = DEPENDENCY_VERSIONS['next'];
  ctx.pkg.dependencies.react = DEPENDENCY_VERSIONS['react'];
  ctx.pkg.dependencies['react-dom'] = DEPENDENCY_VERSIONS['react-dom'];
  ctx.pkg.devDependencies['@types/node'] = DEPENDENCY_VERSIONS['@types/node'];
  ctx.pkg.devDependencies['@types/react'] = DEPENDENCY_VERSIONS['@types/react'];
  ctx.pkg.devDependencies['@types/react-dom'] =
    DEPENDENCY_VERSIONS['@types/react-dom'];
  ctx.pkg.devDependencies.typescript = DEPENDENCY_VERSIONS['typescript'];
  ctx.pkg.devDependencies['@tailwindcss/postcss'] =
    DEPENDENCY_VERSIONS['@tailwindcss/postcss'];
  ctx.pkg.devDependencies.tailwindcss = DEPENDENCY_VERSIONS['tailwindcss'];

  setFile(
    ctx.files,
    'tsconfig.json',
    `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`
  );

  setFile(ctx.files, 'next.config.ts', nextSource['next.config.ts']);

  setFile(ctx.files, 'postcss.config.mjs', nextSource['postcss.config.mjs']);

  setFile(ctx.files, 'next-env.d.ts', nextSource['next-env.d.ts']);
  setFile(ctx.files, 'global.d.ts', nextSource['global.d.ts']);

  setFile(ctx.files, 'app/globals.css', nextSource['app/globals.css']);

  setFile(
    ctx.files,
    'app/layout.tsx',
    `import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: '${ctx.projectName}',
  description: 'Notes app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`
  );

  setFile(
    ctx.files,
    'app/page.tsx',
    `import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">${ctx.projectName}</h1>
      ${
        ctx.stack.backend === 'convex' || ctx.stack.database !== 'none'
          ? `<p>
        <Link className="underline" href="/notes">
          Open notes
        </Link>
      </p>`
          : ''
      }
    </main>
  );
}
`
  );

  setFile(
    ctx.files,
    '.gitignore',
    `node_modules
.next
dist
.env
*.log
`
  );
}
