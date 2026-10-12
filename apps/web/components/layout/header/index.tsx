import Link from 'next/link';
import { Suspense } from 'react';

import { BrandMark } from '@/components/app/brand';
import { CommandMenu } from '@/components/app/command-menu';
import { GitHubIcon } from '@/components/icons';
import { Nav, NavDesktop } from '@/components/layout/navigation/nav-desktop';
import { SiteHeaderNav } from '@/components/layout/navigation/site-header-nav';
import { Button } from '@/components/ui/button';
import { DESKTOP_NAV, GITHUB_REPO_URL, UTM_PARAMS } from '@/config/site';
import { addQueryParams } from '@/utils/url';

import { SiteHeaderMark } from './site-header-mark';
import ThemeToggle from './theme-toggle';

export function SiteHeader() {
  return (
    <SiteHeaderNav>
      <Link
        className="has-data-[visible=false]:pointer-events-none [&_svg]:h-8"
        href="/"
        aria-label="Home"
      >
        <Suspense
          fallback={
            <BrandMark
              fillOpacity={0}
              stroke="currentColor"
              strokeWidth={1}
              aria-hidden
            />
          }
        >
          <SiteHeaderMark />
        </Suspense>
      </Link>
      <div className="flex items-center gap-2 *:first:mr-2 max-md:*:data-[slot=command-menu-trigger]:hidden">
        <Suspense fallback={<Nav items={DESKTOP_NAV} className="mr-2" />}>
          <NavDesktop items={DESKTOP_NAV} />
        </Suspense>
        <CommandMenu />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Open GitHub repository"
          render={
            <a
              href={addQueryParams(GITHUB_REPO_URL, UTM_PARAMS)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open GitHub repository"
            />
          }
          nativeButton={false}
        >
          <GitHubIcon aria-hidden="true" />
          <span className="sr-only">GitHub</span>
        </Button>
        <ThemeToggle />
      </div>
    </SiteHeaderNav>
  );
}
