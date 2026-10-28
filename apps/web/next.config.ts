import { withRedact } from '@tanstack/redact/next';
import type { NextConfig } from 'next';

import { RESUME_PDF_FILENAME } from './config/resume';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    instantInsights: {
      validationLevel: 'manual-warning',
    },
  },
  transpilePackages: ['next-mdx-remote', 'create-gb-app'],
  async headers() {
    return [
      {
        source: '/resume.pdf',
        headers: [
          {
            key: 'Content-Disposition',
            value: `inline; filename="${RESUME_PDF_FILENAME}"`,
          },
        ],
      },
    ];
  },
  images: {
    localPatterns: [
      { pathname: '/**', search: '' },
      { pathname: '/og/simple' },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.giabao.dev',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
      },
    ],
    qualities: [100, 75],
  },
  async redirects() {
    return [
      {
        source: '/projects',
        destination: '/create',
        permanent: true,
      },
      {
        source: '/studio',
        destination: '/create',
        permanent: true,
      },
      {
        source: '/:section(blog|resume)/:slug.mdx',
        destination: '/:section/:slug.md',
        permanent: true,
      },
      {
        source: '/resume.mdx',
        destination: '/resume.md',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      // beforeFiles so these run before prerendered pages are served;
      beforeFiles: [
        ...(process.env.NODE_ENV === 'development'
          ? [{ source: '/resume.pdf', destination: '/api/resume' }]
          : []),
        {
          source: '/:section(blog|resume)/:slug.md',
          destination: '/doc.md/:slug',
        },
        {
          source: '/resume',
          destination: '/resume.md',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)',
            },
          ],
        },
        {
          source: '/:section(blog|resume)/:slug',
          destination: '/doc.md/:slug',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: '(?<accept>.*text/markdown.*)',
            },
          ],
        },
      ],
    };
  },
};

const redactConfig = withRedact(nextConfig);

// shortcut: @tanstack/redact 0.2.2 rewrites `scheduler` without its default export which @react-three/fiber imports
// drop once fixed upstream
for (const rule of [redactConfig.turbopack?.rules?.['*.js'] ?? []].flat()) {
  for (const loader of (rule as { loaders?: unknown[] }).loaders ?? []) {
    const options = (
      loader as { options?: { target?: string; defaultExport?: boolean } }
    ).options;
    if (options && /scheduler[\\/]index\.js$/.test(options.target ?? ''))
      options.defaultExport = true;
  }
}

export default redactConfig;
