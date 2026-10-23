import '@/styles/globals.css';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { WebSite, WithContext } from 'schema-dts';

import { JsonLdScript } from '@/components/json-ld';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fontVariables } from '@/config/font';
import { JSON_LD_ID, personJsonLd } from '@/config/json-ld';
import { META_THEME_COLORS, SITE_INFO, X_PROFILE } from '@/config/site';
import { CommandMenuProvider } from '@/context/command-menu-provider';
import { ProgressProvider } from '@/context/progress-provider';
import { ThemeProvider } from '@/context/theme-provider';
import { USER } from '@/features/portfolio/data/user';
import { cn } from '@/lib/utils';

function getWebSiteJsonLd(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': JSON_LD_ID.website,
    name: SITE_INFO.name,
    url: SITE_INFO.url,
    author: personJsonLd,
    alternateName: USER.alternateName,
  };
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_INFO.url),
  title: {
    template: `%s | ${SITE_INFO.name}`,
    default: `${SITE_INFO.name} – ${USER.jobTitle}`,
  },
  description: SITE_INFO.description,
  keywords: SITE_INFO.keywords,
  authors: [
    {
      name: 'gbaolt',
      url: SITE_INFO.url,
    },
  ],
  creator: 'gbaolt',
  openGraph: {
    siteName: SITE_INFO.name,
    url: '/',
    type: 'profile',
    locale: 'en_US',
    alternateLocale: ['vi_VN'],
    firstName: USER.firstName,
    lastName: USER.lastName,
    username: USER.username,
    gender: USER.gender,
    images: [
      {
        url: SITE_INFO.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_INFO.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: X_PROFILE,
    creator: X_PROFILE,
    images: [SITE_INFO.ogImage],
  },
  icons: {
    icon: [
      {
        url: 'https://assets.giabao.dev/favicon.ico',
        sizes: '256x256',
      },
      {
        url: 'https://assets.giabao.dev/favicon-light.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: 'https://assets.giabao.dev/favicon-dark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: {
      url: 'https://assets.giabao.dev/apple-touch-icon.png',
      type: 'image/png',
      sizes: '180x180',
    },
  },
  robots: {
    googleBot: {
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
};

const darkModeScript = String.raw`
  try {
    if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
    }
  } catch (_) {}

  try {
    if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
      document.documentElement.classList.add('os-macos')
    }
  } catch (_) {}
`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: META_THEME_COLORS.light,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(fontVariables, 'h-full antialiased')}
      suppressHydrationWarning
    >
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{ __html: darkModeScript }}
        />
        <JsonLdScript data={getWebSiteJsonLd()} />
      </head>
      <body>
        <ThemeProvider
          enableSystem
          disableTransitionOnChange
          enableColorScheme
          storageKey="theme"
          defaultTheme="system"
          attribute="class"
        >
          <ProgressProvider
            color="var(--foreground)"
            height="2px"
            delay={300}
            options={{ showSpinner: false }}
          >
            <CommandMenuProvider>
              <TooltipProvider>
                <NuqsAdapter>{children}</NuqsAdapter>
              </TooltipProvider>
            </CommandMenuProvider>
          </ProgressProvider>
          <Toaster position="bottom-center" closeButton />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
